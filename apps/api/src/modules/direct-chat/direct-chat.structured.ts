import { z } from "zod";

import {
  AiError,
  generateObject,
  generateText,
  withThinkingDisabled,
  type AiCallObserver,
  type AiFinishReason,
  type AiMessage,
  type AiModel,
  type AiUsage,
} from "@/infra/ai";

function jsonText(value: string): string {
  const trimmed = value.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1] ?? trimmed;
}

function createDeferredObserver(observer: AiCallObserver) {
  let pending:
    | {
        callId: string;
        result: { finishReason: AiFinishReason; usage: AiUsage | null };
      }
    | undefined;

  return {
    observer: {
      onStart: (input: { structuredOutputMethod: null }) =>
        observer.onStart(input),
      onComplete: async (
        callId: string,
        result: { finishReason: AiFinishReason; usage: AiUsage | null },
      ) => {
        pending = { callId, result };
      },
      onError: async (
        callId: string,
        error: unknown,
        result?: { finishReason: AiFinishReason; usage: AiUsage | null },
      ) => {
        pending = undefined;
        await observer.onError(callId, error, result);
      },
    } satisfies AiCallObserver,
    async complete() {
      if (!pending) return;
      await observer.onComplete(pending.callId, pending.result);
      pending = undefined;
    },
    async fail(error: unknown) {
      if (!pending) return;
      await observer.onError(pending.callId, error, pending.result);
      pending = undefined;
    },
  };
}

async function generatePlainJson<T>(input: {
  maxTokens: number;
  messages: AiMessage[];
  model: AiModel;
  observer: AiCallObserver;
  schema: z.ZodType<T>;
  signal: AbortSignal;
}): Promise<T> {
  const deferred = createDeferredObserver(input.observer);

  try {
    const result = await generateText({
      maxTokens: input.maxTokens,
      messages: [
        {
          role: "system",
          content: `只输出一个 JSON 对象，不要输出 Markdown 或解释。JSON 必须符合这个 Schema：${JSON.stringify(z.toJSONSchema(input.schema))}`,
        },
        ...input.messages,
      ],
      // 回退同样是结构化输出用途：推理会吃掉输出预算导致 JSON 截断。
      model: withThinkingDisabled(input.model),
      observer: deferred.observer,
      signal: input.signal,
      temperature: 0,
    });
    const parsedJson: unknown = JSON.parse(jsonText(result.message.content));
    const parsed = input.schema.safeParse(parsedJson);

    if (!parsed.success) {
      throw new AiError("invalid_output", "模型返回的 JSON 不符合结构约定");
    }

    await deferred.complete();
    return parsed.data;
  } catch (error) {
    const structuredError =
      error instanceof AiError
        ? error
        : new AiError("invalid_output", "模型返回的 JSON 无法解析", {
            cause: error,
          });
    await deferred.fail(structuredError);
    throw structuredError;
  }
}

export async function generateStructuredJson<T>(input: {
  maxTokens: number;
  messages: AiMessage[];
  model: AiModel;
  observer: AiCallObserver;
  schema: z.ZodType<T>;
  schemaName: string;
  signal: AbortSignal;
}): Promise<T> {
  try {
    const result = await generateObject({
      maxTokens: input.maxTokens,
      messages: input.messages,
      model: input.model,
      observer: input.observer,
      schema: input.schema,
      schemaName: input.schemaName,
      signal: input.signal,
      temperature: 0,
    });
    return result.value;
  } catch (error) {
    if (
      !(error instanceof AiError) ||
      (error.code !== "invalid_response" && error.code !== "invalid_output")
    ) {
      throw error;
    }
    return generatePlainJson(input);
  }
}
