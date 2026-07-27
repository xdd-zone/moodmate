import { BizCode } from "@repo/contracts";
import { z } from "zod";

import { AppError } from "@/shared/app-error";
import type {
  ChatCompletionMessage,
  ChatProviderConfig,
} from "@/modules/chat/chat.service";

const UPSTREAM_TIMEOUT_MS = 90_000;

const ChatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z
          .object({
            content: z.unknown().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

/**
 * 群聊非流式 LLM 调用：一次拿完整回复文本。
 * 错误映射对齐 chat.provider.ts 的 createCompanionTextStream。
 */
export async function createGroupChatText(input: {
  messages: ChatCompletionMessage[];
  providerConfig: ChatProviderConfig;
  signal: AbortSignal;
}): Promise<string> {
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
        stream: false,
        ...(input.providerConfig.disableThinking
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

  clearTimeout(timeoutId);

  if (!upstream.ok) {
    console.warn("模型服务返回错误状态", { status: upstream.status });
    await upstream.body?.cancel();
    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "模型请求失败，请检查配置后重试",
      503,
    );
  }

  let rawBody: unknown;

  try {
    rawBody = await upstream.json();
  } catch {
    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "模型服务返回的内容不是有效 JSON",
      503,
    );
  }

  const parsed = ChatCompletionResponseSchema.safeParse(rawBody);
  const content = parsed.success
    ? parsed.data.choices?.[0]?.message?.content
    : undefined;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "模型服务没有返回可用的回复内容",
      503,
    );
  }

  return content.trim();
}
