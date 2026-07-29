/**
 * OpenAI Chat Completions 兼容协议的 Provider 实现。
 *
 * 使用 `chat.completions.create()` 处理普通与流式生成；边界的类型转换集中在
 * openai-compatible.mapper.ts。
 *
 * 约束：
 * - 只依赖 openai SDK 与 infra/ai/types、infra/ai/errors，不 import chat /
 *   group-chat / llm-config / Hono / D1，不反向 import infra/ai/index.ts。
 * - 显式传入后台连接参数、90 秒 timeout、maxRetries: 0 和调用方 AbortSignal。
 * - 仅通过受控 Provider options 发送 disableThinking，业务模块不拼原始 request body。
 * - structured output 方法切换由 runtime 决定，provider 只忠实应用当前 method。
 */

import { OpenAI } from "openai";
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";

import { AiError } from "../../errors";
import type {
  AiApi,
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
  mapFinishReason,
  mapUsage,
  toAssistantMessage,
  toChatMessages,
  toChatTools,
  toStructuredOutputParts,
} from "./openai-compatible.mapper";

const UPSTREAM_TIMEOUT_MS = 90_000;
const OPENAI_CHAT_COMPLETIONS: AiApi = "openai-chat-completions";

/** disableThinking 映射到的上游请求扩展字段。SDK 会原样序列化透传。 */
type ThinkingExtension = {
  thinking?: { type: "disabled" };
};

function createClient(request: AiProviderRequest): OpenAI {
  return new OpenAI({
    apiKey: request.model.apiKey,
    baseURL: request.model.baseURL,
    timeout: UPSTREAM_TIMEOUT_MS,
    maxRetries: 0,
  });
}

/** 构造 SDK 请求体的公共部分（不含 stream 标志）。 */
function buildBaseBody(
  request: AiProviderRequest,
): Omit<ChatCompletionCreateParamsNonStreaming, "stream"> & ThinkingExtension {
  const structured = request.responseFormat
    ? toStructuredOutputParts(request.responseFormat)
    : undefined;

  // structured output 的 function 方法与业务工具互斥：本版本 structured output
  // 请求不与业务工具并用，function 方法产生的 tool/tool_choice 优先。
  const tools =
    structured?.tools ??
    (request.tools && request.tools.length > 0
      ? toChatTools(request.tools)
      : undefined);

  const disableThinking =
    request.model.providerOptions?.["openai-chat-completions"]
      ?.disableThinking ?? false;

  return {
    model: request.model.model,
    messages: toChatMessages(request.messages),
    ...(request.options?.temperature !== undefined
      ? { temperature: request.options.temperature }
      : {}),
    ...(request.options?.maxTokens !== undefined
      ? { max_tokens: request.options.maxTokens }
      : {}),
    ...(tools ? { tools } : {}),
    ...(structured?.toolChoice ? { tool_choice: structured.toolChoice } : {}),
    ...(structured?.responseFormat
      ? { response_format: structured.responseFormat }
      : {}),
    ...(disableThinking ? { thinking: { type: "disabled" } } : {}),
  };
}

async function generate(
  request: AiProviderRequest,
): Promise<AiGenerationResult> {
  const client = createClient(request);
  const startedAt = Date.now();
  const body: ChatCompletionCreateParamsNonStreaming & ThinkingExtension = {
    ...buildBaseBody(request),
    stream: false,
  };

  try {
    const completion = await client.chat.completions.create(body, {
      signal: request.options?.signal,
    });

    const choice = completion.choices[0];

    if (!choice) {
      throw new AiError("invalid_response", "模型服务未返回任何结果", {
        metadata: {
          providerName: request.model.providerName,
          model: request.model.model,
          durationMs: Date.now() - startedAt,
        },
      });
    }

    return {
      message: toAssistantMessage({
        content: choice.message.content,
        toolCalls: choice.message.tool_calls,
      }),
      usage: mapUsage(completion.usage),
      finishReason: mapFinishReason(choice.finish_reason),
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

/** 流式生成时按 index 累积的工具调用增量。 */
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
  const client = createClient(request);
  const startedAt = Date.now();
  const body: ChatCompletionCreateParamsStreaming & ThinkingExtension = {
    ...buildBaseBody(request),
    stream: true,
    stream_options: { include_usage: true },
  };

  yield { type: "start" };

  const toolCalls = new Map<number, ToolCallAccumulator>();
  let usage: AiUsage | null = null;
  let finishReason: ChatCompletionChunk.Choice["finish_reason"] = null;

  try {
    const upstream = await client.chat.completions.create(body, {
      signal: request.options?.signal,
    });

    for await (const chunk of upstream) {
      if (chunk.usage) {
        usage = mapUsage(chunk.usage);
      }

      const choice = chunk.choices[0];

      if (!choice) {
        continue;
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      const delta = choice.delta;

      if (typeof delta.content === "string" && delta.content) {
        yield { type: "text-delta", delta: delta.content };
      }

      for (const toolCall of delta.tool_calls ?? []) {
        const index = toolCall.index;
        const current = toolCalls.get(index) ?? {
          id: "",
          name: "",
          arguments: "",
        };

        if (toolCall.id) {
          current.id = toolCall.id;
        }

        if (toolCall.function?.name) {
          current.name = toolCall.function.name;
        }

        if (toolCall.function?.arguments) {
          current.arguments += toolCall.function.arguments;
        }

        toolCalls.set(index, current);

        yield {
          type: "tool-call-delta",
          index,
          ...(toolCall.id ? { id: toolCall.id } : {}),
          ...(toolCall.function?.name ? { name: toolCall.function.name } : {}),
          ...(toolCall.function?.arguments
            ? { argumentsDelta: toolCall.function.arguments }
            : {}),
        };
      }
    }

    for (const [, accumulated] of [...toolCalls.entries()].sort(
      ([a], [b]) => a - b,
    )) {
      const finished: AiToolCall = {
        id: accumulated.id,
        name: accumulated.name,
        arguments: accumulated.arguments,
      };
      yield { type: "tool-call", toolCall: finished };
    }

    if (usage) {
      yield { type: "usage", usage };
    }

    yield {
      type: "finish",
      finishReason: mapFinishReason(finishReason),
      usage,
    };
  } catch (error) {
    yield {
      type: "error",
      error: mapOpenAiSdkError(error, {
        signal: request.options?.signal,
        providerName: request.model.providerName,
        model: request.model.model,
        durationMs: Date.now() - startedAt,
      }),
    };
  }
}

/** OpenAI Chat Completions 兼容协议 Provider。registry 以 `api` 为 key 选择。 */
export const openAiCompatibleProvider: AiProvider<
  typeof OPENAI_CHAT_COMPLETIONS
> = {
  api: OPENAI_CHAT_COMPLETIONS,
  generate,
  stream,
};
