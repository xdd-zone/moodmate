import { zValidator } from "@hono/zod-validator";
import {
  BizCode,
  CompanionCareEventsResponseSchema,
  CompanionCarePlanResponseSchema,
  CompanionChatRequestSchema,
  CompanionConversationMessagesResponseSchema,
  CompanionConversationResponseSchema,
  CompanionMemoriesResponseSchema,
  DeleteCompanionMemoryResponseSchema,
  GenerateCompanionCareEventRequestSchema,
  GenerateCompanionCareEventResponseSchema,
  SubmitCompanionMessageFeedbackRequestSchema,
  SubmitCompanionMessageFeedbackResponseSchema,
  UpdateCompanionMemoryRequestSchema,
  UpdateCompanionMemoryResponseSchema,
  UpsertCompanionCarePlanRequestSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";
import { z } from "zod";

import {
  streamText,
  toTextByteStream,
  type AiEventStream,
  type AiMessage,
  type AiModel,
  type AiStreamEvent,
} from "@/infra/ai";
import { requireWebAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import { toAiMessages, toAiModel, toChatAppError } from "./chat.ai-model";
import {
  deleteCompanionMemory,
  generateCompanionCareEvent,
  getCompanionCarePlan,
  getCompanionConversation,
  getCompanionConversationMessages,
  getCompanionMemories,
  listCompanionCareEventsForUser,
  prepareCompanionChat,
  saveCompanionAssistantTurn,
  submitCompanionMessageFeedback,
  updateCompanionCarePlan,
  updateCompanionMemory,
} from "./chat.service";

const companionMessageCursorSchema = z.object({
  cursor: z.coerce.number().int().nonnegative(),
});
const companionMemoryParamsSchema = z.object({ memoryId: z.uuid() });
const companionFeedbackParamsSchema = z.object({ messageId: z.uuid() });

function invalidRequest(message: string, details?: unknown) {
  return new AppError(BizCode.COMMON_INVALID_REQUEST, message, 400, details);
}

export function createChatRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/rpc/chat/companion/conversation", requireWebAccess, async (c) => {
      const result = await getCompanionConversation({
        bindings: c.env,
        userId: c.var.webSession.userId,
      });
      const data = CompanionConversationResponseSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)));
    })
    .get(
      "/rpc/chat/companion/messages",
      requireWebAccess,
      zValidator("query", companionMessageCursorSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("历史消息游标无效", result.error.issues);
      }),
      async (c) => {
        const result = await getCompanionConversationMessages({
          beforeMs: c.req.valid("query").cursor,
          bindings: c.env,
          userId: c.var.webSession.userId,
        });
        const data = CompanionConversationMessagesResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .get("/rpc/chat/companion/memories", requireWebAccess, async (c) => {
      const result = await getCompanionMemories({
        bindings: c.env,
        userId: c.var.webSession.userId,
      });
      const data = CompanionMemoriesResponseSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)));
    })
    .patch(
      "/rpc/chat/companion/memories/:memoryId",
      requireWebAccess,
      zValidator("param", companionMemoryParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("记忆 ID 无效", result.error.issues);
      }),
      zValidator("json", UpdateCompanionMemoryRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("记忆内容无效", result.error.issues);
      }),
      async (c) => {
        const result = await updateCompanionMemory({
          bindings: c.env,
          memoryId: c.req.valid("param").memoryId,
          patch: c.req.valid("json"),
          userId: c.var.webSession.userId,
        });
        const data = UpdateCompanionMemoryResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .delete(
      "/rpc/chat/companion/memories/:memoryId",
      requireWebAccess,
      zValidator("param", companionMemoryParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("记忆 ID 无效", result.error.issues);
      }),
      async (c) => {
        const result = await deleteCompanionMemory({
          bindings: c.env,
          memoryId: c.req.valid("param").memoryId,
          userId: c.var.webSession.userId,
        });
        const data = DeleteCompanionMemoryResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/rpc/chat/companion/messages/:messageId/feedback",
      requireWebAccess,
      zValidator("param", companionFeedbackParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("消息 ID 无效", result.error.issues);
      }),
      zValidator(
        "json",
        SubmitCompanionMessageFeedbackRequestSchema,
        (result) => {
          if (result.success) return;
          throw invalidRequest("反馈内容无效", result.error.issues);
        },
      ),
      async (c) => {
        const result = await submitCompanionMessageFeedback({
          bindings: c.env,
          messageId: c.req.valid("param").messageId,
          payload: c.req.valid("json"),
          userId: c.var.webSession.userId,
        });
        const data = SubmitCompanionMessageFeedbackResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .get("/rpc/chat/companion/care-plan", requireWebAccess, async (c) => {
      const result = await getCompanionCarePlan({
        bindings: c.env,
        userId: c.var.webSession.userId,
      });
      const data = CompanionCarePlanResponseSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)));
    })
    .patch(
      "/rpc/chat/companion/care-plan",
      requireWebAccess,
      zValidator("json", UpsertCompanionCarePlanRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("关怀计划内容无效", result.error.issues);
      }),
      async (c) => {
        const result = await updateCompanionCarePlan({
          bindings: c.env,
          payload: c.req.valid("json"),
          userId: c.var.webSession.userId,
        });
        const data = CompanionCarePlanResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .get("/rpc/chat/companion/care-events", requireWebAccess, async (c) => {
      const result = await listCompanionCareEventsForUser({
        bindings: c.env,
        userId: c.var.webSession.userId,
      });
      const data = CompanionCareEventsResponseSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)));
    })
    .post(
      "/rpc/chat/companion/care-events/generate",
      requireWebAccess,
      zValidator("json", GenerateCompanionCareEventRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("生成关怀请求无效", result.error.issues);
      }),
      async (c) => {
        const result = await generateCompanionCareEvent({
          bindings: c.env,
          scene: c.req.valid("json").scene,
          userId: c.var.webSession.userId,
        });
        const data = GenerateCompanionCareEventResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/rpc/chat/companion",
      requireWebAccess,
      zValidator("json", CompanionChatRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("聊天请求内容无效", result.error.issues);
      }),
      async (c) => {
        const payload = c.req.valid("json");
        const chat = await prepareCompanionChat({
          bindings: c.env,
          conversationId: payload.conversationId,
          messages: payload.messages,
          signal: c.req.raw.signal,
          userId: c.var.webSession.userId,
        });

        if (chat.boundaryResponse) {
          await saveCompanionAssistantTurn({
            assistantText: chat.boundaryResponse,
            bindings: c.env,
            turn: chat.turn,
          });

          return c.body(buildTextStream(chat.boundaryResponse), 200, {
            "cache-control": "no-cache, no-transform",
            "content-type": "text/plain; charset=utf-8",
            "x-accel-buffering": "no",
          });
        }

        const stream = await createCompanionTextStream({
          messages: toAiMessages(chat.messages),
          model: toAiModel(chat.providerConfig),
          onComplete: (assistantText) =>
            saveCompanionAssistantTurn({
              assistantText,
              bindings: c.env,
              turn: chat.turn,
            }),
          signal: c.req.raw.signal,
        });

        return c.body(stream, 200, {
          "cache-control": "no-cache, no-transform",
          "content-type": "text/plain; charset=utf-8",
          "x-accel-buffering": "no",
        });
      },
    );
}

/**
 * 单聊流式：用 AI runtime 的 streamText + toTextByteStream 生成纯文本字节流。
 *
 * 预取事件直到首个 text-delta 或流结束，把连接、认证、超时类 AiError 在写响应头前
 * 转成 AppError，保持迁移前 fetch 阶段抛错、由全局 onError 返回干净 JSON 的行为。
 * 首个 text-delta 出现后（响应头已提交）的错误仍以 controller.error 破坏流，
 * 空文本沿用 toTextByteStream 默认 errorOnEmpty，等价旧的「模型未返回文本」。
 */
async function createCompanionTextStream(input: {
  messages: AiMessage[];
  model: AiModel;
  onComplete: (text: string) => Promise<void>;
  signal: AbortSignal;
}): Promise<ReadableStream<Uint8Array>> {
  const eventStream = streamText({
    messages: input.messages,
    model: input.model,
    signal: input.signal,
  });
  const iterator = eventStream[Symbol.asyncIterator]();
  const buffered: AiStreamEvent[] = [];

  while (true) {
    let result: IteratorResult<AiStreamEvent>;

    try {
      result = await iterator.next();
    } catch (error) {
      throw toChatAppError(error);
    }

    if (result.done) {
      break;
    }

    if (result.value.type === "error") {
      throw toChatAppError(result.value.error);
    }

    buffered.push(result.value);

    if (result.value.type === "text-delta") {
      break;
    }
  }

  return toTextByteStream(replayEventStream(buffered, iterator), {
    onComplete: input.onComplete,
  });
}

/** 把预取阶段缓冲的事件先回放，再继续消费原始事件流。 */
async function* replayEventStream(
  buffered: AiStreamEvent[],
  iterator: AsyncIterator<AiStreamEvent>,
): AiEventStream {
  for (const event of buffered) {
    yield event;
  }

  while (true) {
    const result = await iterator.next();

    if (result.done) {
      return;
    }

    yield result.value;
  }
}

function buildTextStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

export default createChatRoute;
