import { AiError } from "./errors";
import type { AiEventStream, AiStreamEvent } from "./types";

/**
 * 内部事件流适配器。
 *
 * 把可异步迭代的 `AiEventStream` 组装成事件数组，或转成现有 chat route 需要的
 * 纯文本字节流。runtime 与 Provider 只产出内部事件；HTTP 边界在这里收口。
 */

/**
 * 把一个同步产生的事件序列包装成 `AiEventStream`，便于测试与组合。
 */
export async function* toEventStream(
  events: Iterable<AiStreamEvent>,
): AsyncGenerator<AiStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

/**
 * 收集事件流为数组，便于测试逐项断言。
 */
export async function collectEvents(
  stream: AiEventStream,
): Promise<AiStreamEvent[]> {
  const events: AiStreamEvent[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}

export interface TextStreamAdapterOptions {
  /** 流正常结束后回调，传入累计的完整文本，供业务写库。 */
  onComplete?: (text: string) => Promise<void>;
  /** 整个流未产出任何文本时是否报错。默认 true，对齐现有 chat 行为。 */
  errorOnEmpty?: boolean;
}

/**
 * 把内部事件流转成纯文本字节流：只编码 `text-delta`，内部累计完整文本。
 *
 * - `error` 事件直接令流失败。
 * - `finish` 或迭代结束后调用 `onComplete(completeText)`。
 * - 默认在没有任何文本时报错，保持现有 chat route「模型未返回文本」的语义。
 */
export function toTextByteStream(
  stream: AiEventStream,
  options?: TextStreamAdapterOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const errorOnEmpty = options?.errorOnEmpty ?? true;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let completeText = "";
      let hasText = false;

      try {
        for await (const event of stream) {
          if (event.type === "error") {
            controller.error(event.error);
            return;
          }

          if (event.type === "text-delta" && event.delta) {
            completeText += event.delta;
            hasText = true;
            controller.enqueue(encoder.encode(event.delta));
          }
        }

        if (!hasText && errorOnEmpty) {
          controller.error(
            new AiError("invalid_response", "模型服务未返回文本内容"),
          );
          return;
        }

        await options?.onComplete?.(completeText);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
