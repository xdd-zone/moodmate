import { zValidator } from "@hono/zod-validator";
import {
  BizCode,
  CreateDirectChatRequestSchema,
  CreateDirectChatResponseSchema,
  DirectChatDetailResponseSchema,
  DirectChatListResponseSchema,
  DirectChatMessagesResponseSchema,
  SendDirectChatMessageRequestSchema,
  SubmitDirectChatMessageFeedbackRequestSchema,
  SubmitDirectChatMessageFeedbackResponseSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";
import { z } from "zod";
import { requireWebAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";
import {
  createDirectChatForUser,
  getDirectChatForUser,
  getDirectMessagesForUser,
  listDirectChatsForUser,
  streamDirectChatForUser,
  submitDirectChatFeedback,
} from "./direct-chat.service";

const idParams = z.object({ conversationId: z.uuid() });
const messageParams = z.object({
  conversationId: z.uuid(),
  messageId: z.uuid(),
});
const cursor = z.object({
  cursor: z.coerce.number().int().nonnegative().optional(),
});
function invalid(message: string, details?: unknown) {
  return new AppError(BizCode.COMMON_INVALID_REQUEST, message, 400, details);
}

export function createDirectChatRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/rpc/direct-chats", requireWebAccess, async (c) =>
      c.json(
        buildSuccess(
          DirectChatListResponseSchema.parse(
            await listDirectChatsForUser({
              bindings: c.env,
              userId: c.var.webSession.userId,
            }),
          ),
          createMeta(c.var.requestId),
        ),
      ),
    )
    .post(
      "/rpc/direct-chats",
      requireWebAccess,
      zValidator("json", CreateDirectChatRequestSchema, (r) => {
        if (!r.success) throw invalid("朋友 ID 无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            CreateDirectChatResponseSchema.parse(
              await createDirectChatForUser({
                ...c.req.valid("json"),
                bindings: c.env,
                userId: c.var.webSession.userId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .get(
      "/rpc/direct-chats/:conversationId",
      requireWebAccess,
      zValidator("param", idParams, (r) => {
        if (!r.success) throw invalid("会话 ID 无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            DirectChatDetailResponseSchema.parse(
              await getDirectChatForUser({
                conversationId: c.req.valid("param").conversationId,
                bindings: c.env,
                userId: c.var.webSession.userId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .get(
      "/rpc/direct-chats/:conversationId/messages",
      requireWebAccess,
      zValidator("param", idParams, (r) => {
        if (!r.success) throw invalid("会话 ID 无效", r.error.issues);
      }),
      zValidator("query", cursor, (r) => {
        if (!r.success) throw invalid("消息游标无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            DirectChatMessagesResponseSchema.parse(
              await getDirectMessagesForUser({
                conversationId: c.req.valid("param").conversationId,
                cursor: c.req.valid("query").cursor,
                bindings: c.env,
                userId: c.var.webSession.userId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .post(
      "/rpc/direct-chats/:conversationId/messages",
      requireWebAccess,
      zValidator("param", idParams, (r) => {
        if (!r.success) throw invalid("会话 ID 无效", r.error.issues);
      }),
      zValidator("json", SendDirectChatMessageRequestSchema, (r) => {
        if (!r.success) throw invalid("消息内容无效", r.error.issues);
      }),
      async (c) =>
        c.body(
          await streamDirectChatForUser({
            conversationId: c.req.valid("param").conversationId,
            messages: c.req.valid("json").messages,
            bindings: c.env,
            requestId: c.var.requestId,
            signal: c.req.raw.signal,
            userId: c.var.webSession.userId,
          }),
          200,
          {
            "cache-control": "no-cache, no-transform",
            "content-type": "text/plain; charset=utf-8",
            "x-accel-buffering": "no",
          },
        ),
    )
    .post(
      "/rpc/direct-chats/:conversationId/messages/:messageId/feedback",
      requireWebAccess,
      zValidator("param", messageParams, (r) => {
        if (!r.success) throw invalid("消息 ID 无效", r.error.issues);
      }),
      zValidator("json", SubmitDirectChatMessageFeedbackRequestSchema, (r) => {
        if (!r.success) throw invalid("反馈内容无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            SubmitDirectChatMessageFeedbackResponseSchema.parse(
              await submitDirectChatFeedback({
                conversationId: c.req.valid("param").conversationId,
                messageId: c.req.valid("param").messageId,
                payload: c.req.valid("json"),
                bindings: c.env,
                userId: c.var.webSession.userId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    );
}
