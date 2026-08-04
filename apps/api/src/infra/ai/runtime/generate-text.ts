/**
 * 文本生成 runtime。
 *
 * 统一 registry 查找、错误传播和事件输出，不知道具体协议字段：
 * - `generateText()`：非流式；提供工具时进入工具执行循环。
 * - `streamText()`：流式；直接透传 Provider 内部事件流，供纯文本适配器转发。
 *
 * runtime 不创建 AppError，不依赖 chat / group-chat / Hono / D1 / LangGraph。
 * `AiError` 向上传播由业务边界转换；`aborted` 保持取消语义向上抛。
 */

import { AiError } from "../errors";
import { getAiProvider } from "../provider-registry";
import type {
  AiEventStream,
  AiGenerationOptions,
  AiGenerationResult,
  AiMessage,
  AiModel,
  AiTool,
  AiCallObserver,
} from "../types";
import { runToolCallingLoop } from "./execute-tools";

export interface GenerateTextOptions {
  model: AiModel;
  messages: AiMessage[];
  /** 本轮显式传入的工具，可选。传入后进入工具执行循环。 */
  tools?: AiTool[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** 工具循环最大模型调用轮数，默认 5。 */
  maxSteps?: number;
  observer?: AiCallObserver;
}

/**
 * 非流式文本生成。
 *
 * 无工具时直接调 Provider 返回结果；有工具时进入工具执行循环，
 * 循环内部按返回顺序校验并执行工具、把结果交回模型，最多默认 5 轮。
 */
export async function generateText(
  options: GenerateTextOptions,
): Promise<AiGenerationResult> {
  const provider = getAiProvider(options.model.api);
  const generationOptions = toGenerationOptions(options);

  if (options.tools && options.tools.length > 0) {
    return runToolCallingLoop({
      provider,
      model: options.model,
      messages: options.messages,
      tools: options.tools,
      generationOptions,
      observer: options.observer,
      ...(options.maxSteps !== undefined ? { maxSteps: options.maxSteps } : {}),
    });
  }

  const callId = await options.observer?.onStart({
    structuredOutputMethod: null,
  });
  try {
    const result = await provider.generate({
      model: options.model,
      messages: options.messages,
      options: generationOptions,
    });
    if (callId) await options.observer?.onComplete(callId, result);
    return result;
  } catch (error) {
    if (callId) await options.observer?.onError(callId, error);
    throw error;
  }
}

export interface StreamTextOptions {
  model: AiModel;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  observer?: AiCallObserver;
}

/**
 * 流式文本生成。直接返回 Provider 内部事件流；
 * HTTP 边界由 `toTextByteStream` 只转发 `text-delta` 并累计完整文本。
 */
export function streamText(options: StreamTextOptions): AiEventStream {
  const provider = getAiProvider(options.model.api);
  return observeStream(
    provider.stream({
      model: options.model,
      messages: options.messages,
      options: toGenerationOptions(options),
    }),
    options.observer,
  );
}

async function* observeStream(
  stream: AiEventStream,
  observer?: AiCallObserver,
): AiEventStream {
  const callId = await observer?.onStart({ structuredOutputMethod: null });
  let settled = false;
  try {
    for await (const event of stream) {
      if (event.type === "finish" && callId) {
        settled = true;
        await observer?.onComplete(callId, event);
      }
      if (event.type === "error" && callId) {
        settled = true;
        await observer?.onError(callId, event.error);
      }
      yield event;
    }
  } catch (error) {
    if (callId && !settled) {
      settled = true;
      await observer?.onError(callId, error);
    }
    throw error;
  } finally {
    if (callId && !settled) {
      await observer?.onError(
        callId,
        new AiError("aborted", "模型流在完成前被中止"),
      );
    }
  }
}

function toGenerationOptions(options: {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): AiGenerationOptions {
  return {
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
    ...(options.maxTokens !== undefined
      ? { maxTokens: options.maxTokens }
      : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
}
