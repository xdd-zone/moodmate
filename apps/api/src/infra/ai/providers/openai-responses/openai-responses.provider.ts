import { OpenAI } from "openai";
import type {
  ResponseCreateParamsBase,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseFunctionToolCall,
} from "openai/resources/responses/responses";

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
import { mapOpenAiSdkError } from "../openai-sdk-error";
import {
  mapResponsesFinishReason,
  mapResponsesUsage,
  toResponsesAssistantMessage,
  toResponsesRequestParts,
} from "./openai-responses.mapper";

const OPENAI_RESPONSES = "openai-responses" as const;
const MIN_OUTPUT_TOKENS = 16;
const UPSTREAM_TIMEOUT_MS = 90_000;

function createClient(request: AiProviderRequest): OpenAI {
  return new OpenAI({
    apiKey: request.model.apiKey,
    baseURL: request.model.baseURL,
    timeout: UPSTREAM_TIMEOUT_MS,
    maxRetries: 0,
  });
}

function buildBaseBody(request: AiProviderRequest): ResponseCreateParamsBase {
  return {
    model: request.model.model,
    store: false,
    ...toResponsesRequestParts(request),
    ...(request.options?.temperature !== undefined
      ? { temperature: request.options.temperature }
      : {}),
    ...(request.options?.maxTokens !== undefined
      ? {
          max_output_tokens: Math.max(
            request.options.maxTokens,
            MIN_OUTPUT_TOKENS,
          ),
        }
      : {}),
  };
}

async function generate(
  request: AiProviderRequest,
): Promise<AiGenerationResult> {
  const startedAt = Date.now();

  try {
    const body: ResponseCreateParamsNonStreaming = {
      ...buildBaseBody(request),
      stream: false,
    };
    const response = await createClient(request).responses.create(body, {
      signal: request.options?.signal,
    });
    const message = toResponsesAssistantMessage(response);
    const hasToolCalls = (message.toolCalls?.length ?? 0) > 0;

    return {
      message,
      usage: mapResponsesUsage(response.usage),
      finishReason: mapResponsesFinishReason(response.status, hasToolCalls),
    };
  } catch (error) {
    if (error instanceof AiError) {
      throw error;
    }

    throw mapOpenAiSdkError(error, {
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
  emitted: boolean;
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
    const body: ResponseCreateParamsStreaming = {
      ...buildBaseBody(request),
      stream: true,
    };
    const upstream = await createClient(request).responses.create(body, {
      signal: request.options?.signal,
    });
    const toolCalls = new Map<number, ToolCallAccumulator>();
    let usage: AiUsage | null = null;
    let finishReason: AiGenerationResult["finishReason"] = "unknown";
    let hasToolCalls = false;
    let terminal = false;

    for await (const event of upstream) {
      switch (event.type) {
        case "response.output_text.delta":
          if (event.delta) {
            yield { type: "text-delta", delta: event.delta };
          }
          break;
        case "response.refusal.delta":
          if (event.delta) {
            yield { type: "text-delta", delta: event.delta };
          }
          break;
        case "response.output_item.added":
          if (event.item.type === "function_call") {
            hasToolCalls = true;
            toolCalls.set(
              event.output_index,
              createToolAccumulator(event.item),
            );
            yield {
              type: "tool-call-delta",
              index: event.output_index,
              id: event.item.call_id,
              name: event.item.name,
            };
          }
          break;
        case "response.function_call_arguments.delta": {
          const current = toolCalls.get(event.output_index);

          if (current) {
            current.arguments += event.delta;
            yield {
              type: "tool-call-delta",
              index: event.output_index,
              argumentsDelta: event.delta,
            };
          }
          break;
        }
        case "response.function_call_arguments.done": {
          const current = toolCalls.get(event.output_index);

          if (current) {
            const argumentsDelta = getArgumentsDelta(
              current.arguments,
              event.arguments,
            );
            current.arguments = event.arguments;

            if (argumentsDelta) {
              yield {
                type: "tool-call-delta",
                index: event.output_index,
                argumentsDelta,
              };
            }
          }
          break;
        }
        case "response.output_item.done":
          if (event.item.type === "function_call") {
            hasToolCalls = true;
            const current =
              toolCalls.get(event.output_index) ??
              createToolAccumulator(event.item);
            current.id = event.item.call_id;
            current.name = event.item.name;
            const argumentsDelta = getArgumentsDelta(
              current.arguments,
              event.item.arguments,
            );
            current.arguments = event.item.arguments;

            if (argumentsDelta) {
              yield {
                type: "tool-call-delta",
                index: event.output_index,
                argumentsDelta,
              };
            }

            if (!current.emitted) {
              current.emitted = true;
              yield { type: "tool-call", toolCall: toToolCall(current) };
            }
            toolCalls.set(event.output_index, current);
          }
          break;
        case "response.completed":
        case "response.incomplete":
          terminal = true;
          usage = mapResponsesUsage(event.response.usage);
          finishReason = mapResponsesFinishReason(
            event.response.status,
            hasToolCalls,
          );
          break;
        case "response.failed":
          throw new AiError("upstream_error", "模型服务生成失败", {
            metadata: {
              providerName: request.model.providerName,
              model: request.model.model,
              durationMs: Date.now() - startedAt,
            },
          });
        case "error":
          throw new AiError("upstream_error", "模型服务流返回错误", {
            metadata: {
              providerName: request.model.providerName,
              model: request.model.model,
              durationMs: Date.now() - startedAt,
            },
          });
        default:
          break;
      }
    }

    if (!terminal) {
      throw new AiError("invalid_response", "OpenAI Responses 流未正常结束", {
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

    yield { type: "finish", finishReason, usage };
  } catch (error) {
    yield {
      type: "error",
      error:
        error instanceof AiError
          ? error
          : mapOpenAiSdkError(error, {
              signal: request.options?.signal,
              providerName: request.model.providerName,
              model: request.model.model,
              durationMs: Date.now() - startedAt,
            }),
    };
  }
}

function createToolAccumulator(
  item: ResponseFunctionToolCall,
): ToolCallAccumulator {
  return {
    id: item.call_id,
    name: item.name,
    arguments: "",
    emitted: false,
  };
}

function getArgumentsDelta(current: string, completed: string): string {
  return completed.startsWith(current) ? completed.slice(current.length) : "";
}

function toToolCall(accumulator: ToolCallAccumulator): AiToolCall {
  return {
    id: accumulator.id,
    name: accumulator.name,
    arguments: accumulator.arguments || "{}",
  };
}

export const openAiResponsesProvider: AiProvider<typeof OPENAI_RESPONSES> = {
  api: OPENAI_RESPONSES,
  generate,
  stream,
};
