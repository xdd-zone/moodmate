import { BizCode } from "@repo/contracts";
import { z } from "zod";

import { AppError } from "@/shared/app-error";
import type { ChatCompletionMessage, ChatProviderConfig } from "./chat.service";

const UPSTREAM_TIMEOUT_MS = 90_000;

const DeepSeekStreamChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.unknown().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export async function createCompanionTextStream(input: {
  messages: ChatCompletionMessage[];
  onComplete?: (text: string) => Promise<void>;
  providerConfig: ChatProviderConfig;
  signal: AbortSignal;
}): Promise<ReadableStream<Uint8Array>> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    UPSTREAM_TIMEOUT_MS,
  );
  const signal = AbortSignal.any([input.signal, timeoutController.signal]);
  let upstream: Response;

  try {
    upstream = await fetch(`${input.providerConfig.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.providerConfig.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.providerConfig.model,
        messages: input.messages,
        stream: true,
        ...(input.providerConfig.isPlatformDeepSeek
          ? { thinking: { type: "disabled" } }
          : {}),
      }),
      signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (timeoutController.signal.aborted && !input.signal.aborted) {
      throw new AppError(
        BizCode.SYSTEM_UPSTREAM_TIMEOUT,
        "模型服务响应超时，请稍后重试",
        504,
      );
    }

    if (input.signal.aborted) {
      throw error;
    }

    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "无法连接模型服务，请稍后重试",
      503,
    );
  }

  if (!upstream.ok) {
    clearTimeout(timeoutId);
    console.warn("模型服务返回错误状态", { status: upstream.status });
    await upstream.body?.cancel();
    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "模型请求失败，请检查配置后重试",
      503,
    );
  }

  if (!upstream.body) {
    clearTimeout(timeoutId);
    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "模型服务没有返回可读取的内容",
      503,
    );
  }

  return convertSseToTextStream(
    upstream.body,
    () => clearTimeout(timeoutId),
    input.onComplete,
  );
}

function convertSseToTextStream(
  upstreamBody: ReadableStream<Uint8Array>,
  cleanup: () => void,
  onComplete?: (text: string) => Promise<void>,
): ReadableStream<Uint8Array> {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let completeText = "";
      let hasText = false;
      const collectText = (text: string) => {
        completeText += text;
      };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            buffer += decoder.decode();
            const emittedText = emitCompleteLines(
              buffer,
              controller,
              encoder,
              collectText,
            );
            hasText ||= emittedText;
            await finishStream(controller, hasText, completeText, onComplete);
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const result = emitSseLine(line, controller, encoder, collectText);
            hasText ||= result === "text";

            if (result === "done") {
              await reader.cancel();
              await finishStream(controller, hasText, completeText, onComplete);
              return;
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        cleanup();
      }
    },
    cancel(reason) {
      cleanup();
      return reader.cancel(reason);
    },
  });
}

async function finishStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  hasText: boolean,
  completeText: string,
  onComplete?: (text: string) => Promise<void>,
): Promise<void> {
  if (!hasText) {
    controller.error(new Error("模型服务未返回文本内容"));
    return;
  }

  await onComplete?.(completeText);
  controller.close();
}

function emitCompleteLines(
  value: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  onText: (text: string) => void,
): boolean {
  let hasText = false;

  for (const line of value.split("\n")) {
    const result = emitSseLine(line, controller, encoder, onText);
    hasText ||= result === "text";
  }

  return hasText;
}

function emitSseLine(
  value: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  onText: (text: string) => void,
): "done" | "ignored" | "text" {
  const line = value.endsWith("\r") ? value.slice(0, -1) : value;

  if (!line.startsWith("data:")) {
    return "ignored";
  }

  const data = line.slice(5).trimStart();

  if (data === "[DONE]") {
    return "done";
  }

  let rawPayload: unknown;

  try {
    rawPayload = JSON.parse(data);
  } catch {
    throw new Error("模型服务返回的流格式无效");
  }

  const payload = DeepSeekStreamChunkSchema.safeParse(rawPayload);

  if (!payload.success) {
    throw new Error("模型服务返回的流格式无效");
  }

  const content = payload.data.choices?.[0]?.delta?.content;

  if (typeof content === "string" && content) {
    onText(content);
    controller.enqueue(encoder.encode(content));
    return "text";
  }

  return "ignored";
}
