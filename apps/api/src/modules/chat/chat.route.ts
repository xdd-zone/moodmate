import { zValidator } from "@hono/zod-validator";
import {
  BizCode,
  CompanionChatRequestSchema,
  CompanionConversationMessagesResponseSchema,
  CompanionConversationResponseSchema,
  CompanionMemoriesResponseSchema,
  DeleteCompanionMemoryResponseSchema,
  UpdateCompanionMemoryRequestSchema,
  UpdateCompanionMemoryResponseSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";
import { z } from "zod";

import { requireWebAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import { createCompanionTextStream } from "./chat.provider";
import {
  deleteCompanionMemory,
  getCompanionConversation,
  getCompanionConversationMessages,
  getCompanionMemories,
  prepareCompanionChat,
  saveCompanionAssistantTurn,
  updateCompanionMemory,
} from "./chat.service";

const companionMessageCursorSchema = z.object({
  cursor: z.coerce.number().int().nonnegative(),
});
const companionMemoryParamsSchema = z.object({ memoryId: z.uuid() });

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
          llmConfig: payload.llmConfig,
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
          messages: chat.messages,
          onComplete: (assistantText) =>
            saveCompanionAssistantTurn({
              assistantText,
              bindings: c.env,
              turn: chat.turn,
            }),
          providerConfig: chat.providerConfig,
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

function buildTextStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

export default createChatRoute;
