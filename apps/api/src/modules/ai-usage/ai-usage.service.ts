import type {
  AiCallConversationType,
  AiCallScenario,
  AiCallSubjectType,
  AgentSource,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import { isAiError, type AiCallObserver, type AiModel } from "@/infra/ai";
import type { ApiBindings } from "@/shared/hono-env";
import {
  completeAiCall,
  failAiCall,
  insertAiCall,
  newAiCallId,
} from "./ai-usage.repository";

const ERROR_MESSAGE_MAX_LENGTH = 500;
const ERROR_CAUSE_MAX_DEPTH = 5;

/**
 * 沿 cause 链拼出上游原始报错文本，写入调用记录供排查。
 *
 * `AiError.message` 是面向业务的中文短句，信息量等同 `errorCode`；真正有诊断价值的
 * 是上游返回的原文，例如 `This response_format type is unavailable now` 或
 * workerd 的 `Network connection lost`，它们只出现在 cause 链里。
 * 只保留协议层报错，不包含 prompt 与模型回复。
 */
function toUpstreamErrorMessage(error: unknown): string | null {
  const messages: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < ERROR_CAUSE_MAX_DEPTH; depth += 1) {
    if (!(current instanceof Error)) break;
    if (current.message && !messages.includes(current.message)) {
      messages.push(current.message);
    }
    current = (current as { cause?: unknown }).cause;
  }

  const text = messages.join(" <- ").slice(0, ERROR_MESSAGE_MAX_LENGTH);

  return text || null;
}

export interface AiUsageContext {
  agent?: { id: string; name: string; source: AgentSource };
  bindings: ApiBindings;
  conversationId?: string;
  conversationType: AiCallConversationType;
  initiatorId?: string;
  initiatorType: "web_user" | "admin" | "system";
  llmConfigId?: string;
  model: AiModel;
  requestId: string;
  scenario: AiCallScenario;
  subjectType: AiCallSubjectType;
  userId?: string;
}

export function createAiCallObserver(context: AiUsageContext): AiCallObserver {
  const operationId = uuidv7();
  let attemptIndex = 0;
  const startedById = new Map<string, number>();
  return {
    async onStart(input) {
      const id = newAiCallId();
      const startedAtMs = Date.now();
      startedById.set(id, startedAtMs);
      await insertAiCall({
        database: context.bindings.DB,
        id,
        operationId,
        attemptIndex: attemptIndex++,
        requestId: context.requestId,
        userId: context.userId ?? null,
        initiatorType: context.initiatorType,
        initiatorId: context.initiatorId ?? null,
        subjectType: context.subjectType,
        agentId: context.agent?.id ?? null,
        agentNameSnapshot: context.agent?.name ?? null,
        agentSourceSnapshot: context.agent?.source ?? null,
        scenario: context.scenario,
        conversationType: context.conversationType,
        conversationId: context.conversationId ?? null,
        llmConfigId: context.llmConfigId ?? null,
        api: context.model.api,
        providerName: context.model.providerName,
        model: context.model.model,
        structuredOutputMethod: input.structuredOutputMethod,
        status: "started",
        usageStatus: "pending",
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        finishReason: null,
        errorCode: null,
        durationMs: null,
        startedAtMs,
        finishedAtMs: null,
      });
      return id;
    },
    async onComplete(callId, result) {
      const finishedAtMs = Date.now();
      try {
        await completeAiCall({
          callId,
          database: context.bindings.DB,
          durationMs: finishedAtMs - (startedById.get(callId) ?? finishedAtMs),
          finishReason: result.finishReason,
          finishedAtMs,
          usage: result.usage,
        });
      } catch (error) {
        console.error("AI 调用完成状态写入失败", {
          callId,
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        startedById.delete(callId);
      }
    },
    async onError(callId, error, result) {
      const finishedAtMs = Date.now();
      const code = isAiError(error) ? error.code : "internal";
      try {
        await failAiCall({
          callId,
          database: context.bindings.DB,
          durationMs: finishedAtMs - (startedById.get(callId) ?? finishedAtMs),
          errorCode: code,
          errorMessage: toUpstreamErrorMessage(error),
          finishReason: result?.finishReason ?? null,
          finishedAtMs,
          status: code === "aborted" ? "aborted" : "failed",
          usage: result?.usage ?? null,
        });
      } catch (writeError) {
        console.error("AI 调用失败状态写入失败", {
          callId,
          requestId: context.requestId,
          error:
            writeError instanceof Error
              ? writeError.message
              : String(writeError),
        });
      } finally {
        startedById.delete(callId);
      }
    },
  };
}
