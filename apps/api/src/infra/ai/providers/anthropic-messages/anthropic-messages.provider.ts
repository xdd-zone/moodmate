import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageCreateParamsBase,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  MessageDeltaUsage,
  StopReason,
} from "@anthropic-ai/sdk/resources/messages";

import { AiError } from "../../errors";
import type {
  AiEventStream,
  AiGenerationResult,
  AiProvider,
  AiProviderRequest,
  AiStreamEvent,
  AiToolCall,
  AiUsage,
} from "../../types";
import {
  mapAnthropicFinishReason,
  mapAnthropicSdkError,
  mapAnthropicUsage,
  toAnthropicAssistantMessage,
  toAnthropicMessages,
  toAnthropicTools,
} from "./anthropic-messages.mapper";

const ANTHROPIC_MESSAGES = "anthropic-messages" as const;
const DEFAULT_MAX_TOKENS = 4096;
const UPSTREAM_TIMEOUT_MS = 90_000;

function createClient(request: AiProviderRequest): Anthropic {
  return new Anthropic({
    apiKey: request.model.apiKey,
    baseURL: request.model.baseURL,
    timeout: UPSTREAM_TIMEOUT_MS,
    maxRetries: 0,
    dangerouslyAllowBrowser: true,
  });
}

function buildBaseBody(request: AiProviderRequest): MessageCreateParamsBase {
  const input = toAnthropicMessages(request.messages);
  let tools =
    request.tools && request.tools.length > 0
      ? toAnthropicTools(request.tools)
      : undefined;
  let toolChoice: MessageCreateParamsBase["tool_choice"];

  if (request.responseFormat) {
    if (request.responseFormat.method !== "function") {
      throw new AiError(
        "invalid_response",
        `Anthropic Messages 不支持 ${request.responseFormat.method} structured output`,
        {
          metadata: {
            providerName: request.model.providerName,
            model: request.model.model,
          },
        },
      );
    }

    tools = toAnthropicTools([
      {
        name: request.responseFormat.name,
        description: `生成 ${request.responseFormat.name} 结构化结果`,
        parameters: request.responseFormat.jsonSchema,
      },
    ]);
    toolChoice = { type: "tool", name: request.responseFormat.name };
  }

  return {
    model: request.model.model,
    messages: input.messages,
    max_tokens: request.options?.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(input.system ? { system: input.system } : {}),
    ...(request.options?.temperature !== undefined
      ? { temperature: request.options.temperature }
      : {}),
    ...(tools ? { tools } : {}),
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
  };
}

async function generate(
  request: AiProviderRequest,
): Promise<AiGenerationResult> {
  const startedAt = Date.now();

  try {
    const body: MessageCreateParamsNonStreaming = {
      ...buildBaseBody(request),
      stream: false,
    };
    const message = await createClient(request).messages.create(body, {
      signal: request.options?.signal,
    });

    return {
      message: toAnthropicAssistantMessage(message),
      usage: mapAnthropicUsage(message.usage),
      finishReason: mapAnthropicFinishReason(message.stop_reason),
    };
  } catch (error) {
    if (error instanceof AiError) {
      throw error;
    }

    throw mapAnthropicSdkError(error, {
      signal: request.options?.signal,
      providerName: request.model.providerName,
      model: request.model.model,
      durationMs: Date.now() - startedAt,
    });
  }
}

interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

function stream(request: AiProviderRequest): AiEventStream {
  return streamGenerator(request);
}

async function* streamGenerator(
  request: AiProviderRequest,
): AsyncGenerator<AiStreamEvent> {
  const startedAt = Date.now();

  yield { type: "start" };

  try {
    const body: MessageCreateParamsStreaming = {
      ...buildBaseBody(request),
      stream: true,
    };
    const upstream = await createClient(request).messages.create(body, {
      signal: request.options?.signal,
    });
    const toolCalls = new Map<number, ToolCallAccumulator>();
    let usage: AiUsage | null = null;
    let finishReason: StopReason | null = null;
    let stopped = false;

    for await (const event of upstream) {
      switch (event.type) {
        case "message_start":
          usage = mapAnthropicUsage(event.message.usage);
          break;
        case "content_block_start":
          if (event.content_block.type === "tool_use") {
            toolCalls.set(event.index, {
              id: event.content_block.id,
              name: event.content_block.name,
              arguments: "",
            });
            yield {
              type: "tool-call-delta",
              index: event.index,
              id: event.content_block.id,
              name: event.content_block.name,
            };
          }
          break;
        case "content_block_delta":
          if (event.delta.type === "text_delta" && event.delta.text) {
            yield { type: "text-delta", delta: event.delta.text };
          } else if (event.delta.type === "input_json_delta") {
            const current = toolCalls.get(event.index);

            if (current) {
              current.arguments += event.delta.partial_json;
              yield {
                type: "tool-call-delta",
                index: event.index,
                argumentsDelta: event.delta.partial_json,
              };
            }
          }
          break;
        case "content_block_stop": {
          const current = toolCalls.get(event.index);

          if (current) {
            const toolCall: AiToolCall = {
              id: current.id,
              name: current.name,
              arguments: current.arguments || "{}",
            };
            yield { type: "tool-call", toolCall };
          }
          break;
        }
        case "message_delta":
          finishReason = event.delta.stop_reason;
          usage = mergeStreamUsage(usage, event.usage);
          break;
        case "message_stop":
          stopped = true;
          break;
      }
    }

    if (!stopped) {
      throw new AiError("invalid_response", "Anthropic 消息流未正常结束", {
        metadata: {
          providerName: request.model.providerName,
          model: request.model.model,
          durationMs: Date.now() - startedAt,
        },
      });
    }

    if (usage) {
      yield { type: "usage", usage };
    }

    yield {
      type: "finish",
      finishReason: mapAnthropicFinishReason(finishReason),
      usage,
    };
  } catch (error) {
    yield {
      type: "error",
      error:
        error instanceof AiError
          ? error
          : mapAnthropicSdkError(error, {
              signal: request.options?.signal,
              providerName: request.model.providerName,
              model: request.model.model,
              durationMs: Date.now() - startedAt,
            }),
    };
  }
}

function mergeStreamUsage(
  current: AiUsage | null,
  delta: MessageDeltaUsage,
): AiUsage {
  const promptTokens =
    delta.input_tokens === null
      ? (current?.promptTokens ?? 0)
      : delta.input_tokens +
        (delta.cache_creation_input_tokens ?? 0) +
        (delta.cache_read_input_tokens ?? 0);
  const completionTokens = delta.output_tokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export const anthropicMessagesProvider: AiProvider<typeof ANTHROPIC_MESSAGES> =
  {
    api: ANTHROPIC_MESSAGES,
    generate,
    stream,
  };
