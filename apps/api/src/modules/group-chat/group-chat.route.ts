import { zValidator } from "@hono/zod-validator";
import {
  AddAgentGroupChatMembersRequestSchema,
  AddAgentGroupChatMembersResponseSchema,
  AgentGroupChatDetailResponseSchema,
  AgentGroupChatListResponseSchema,
  AgentGroupChatMessagesResponseSchema,
  BizCode,
  CreateAgentGroupChatRequestSchema,
  CreateAgentGroupChatResponseSchema,
  RemoveAgentGroupChatMemberResponseSchema,
  SendAgentGroupChatMessageRequestSchema,
  SendAgentGroupChatMessageResponseSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";
import { z } from "zod";

import { requireWebAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import {
  addGroupChatMembers,
  createGroupChatForUser,
  getGroupChatDetail,
  getGroupChatMessages,
  listGroupChatsForUser,
  removeGroupChatMember,
  sendGroupChatMessage,
} from "./group-chat.service";

const groupChatParamsSchema = z.object({ groupChatId: z.string().min(1) });
const memberParamsSchema = z.object({
  groupChatId: z.string().min(1),
  memberId: z.string().min(1),
});
const messagesQuerySchema = z.object({
  cursor: z.coerce.number().int().nonnegative().optional(),
});

function invalidRequest(message: string, details?: unknown) {
  return new AppError(BizCode.COMMON_INVALID_REQUEST, message, 400, details);
}

export function createGroupChatRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/rpc/chat/group", requireWebAccess, async (c) => {
      const result = await listGroupChatsForUser({
        bindings: c.env,
        userId: c.var.webSession.userId,
      });
      const data = AgentGroupChatListResponseSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)));
    })
    .post(
      "/rpc/chat/group",
      requireWebAccess,
      zValidator("json", CreateAgentGroupChatRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("群聊创建参数无效", result.error.issues);
      }),
      async (c) => {
        const result = await createGroupChatForUser({
          bindings: c.env,
          payload: c.req.valid("json"),
          userId: c.var.webSession.userId,
        });
        const data = CreateAgentGroupChatResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .get(
      "/rpc/chat/group/:groupChatId",
      requireWebAccess,
      zValidator("param", groupChatParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("群聊 ID 无效", result.error.issues);
      }),
      async (c) => {
        const result = await getGroupChatDetail({
          bindings: c.env,
          groupChatId: c.req.valid("param").groupChatId,
          userId: c.var.webSession.userId,
        });
        const data = AgentGroupChatDetailResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .get(
      "/rpc/chat/group/:groupChatId/messages",
      requireWebAccess,
      zValidator("param", groupChatParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("群聊 ID 无效", result.error.issues);
      }),
      zValidator("query", messagesQuerySchema, (result) => {
        if (result.success) return;
        throw invalidRequest("游标参数无效", result.error.issues);
      }),
      async (c) => {
        const result = await getGroupChatMessages({
          bindings: c.env,
          cursor: c.req.valid("query").cursor,
          groupChatId: c.req.valid("param").groupChatId,
          userId: c.var.webSession.userId,
        });
        const data = AgentGroupChatMessagesResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/rpc/chat/group/:groupChatId/send",
      requireWebAccess,
      zValidator("param", groupChatParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("群聊 ID 无效", result.error.issues);
      }),
      zValidator("json", SendAgentGroupChatMessageRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("发送内容无效", result.error.issues);
      }),
      async (c) => {
        const result = await sendGroupChatMessage({
          bindings: c.env,
          groupChatId: c.req.valid("param").groupChatId,
          message: c.req.valid("json").message,
          requestId: c.var.requestId,
          signal: c.req.raw.signal,
          userId: c.var.webSession.userId,
        });
        const data = SendAgentGroupChatMessageResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/rpc/chat/group/:groupChatId/members",
      requireWebAccess,
      zValidator("param", groupChatParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("群聊 ID 无效", result.error.issues);
      }),
      zValidator("json", AddAgentGroupChatMembersRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("成员参数无效", result.error.issues);
      }),
      async (c) => {
        const result = await addGroupChatMembers({
          bindings: c.env,
          groupChatId: c.req.valid("param").groupChatId,
          payload: c.req.valid("json"),
          userId: c.var.webSession.userId,
        });
        const data = AddAgentGroupChatMembersResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .delete(
      "/rpc/chat/group/:groupChatId/members/:memberId",
      requireWebAccess,
      zValidator("param", memberParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("成员 ID 无效", result.error.issues);
      }),
      async (c) => {
        const result = await removeGroupChatMember({
          bindings: c.env,
          groupChatId: c.req.valid("param").groupChatId,
          memberId: c.req.valid("param").memberId,
          userId: c.var.webSession.userId,
        });
        const data = RemoveAgentGroupChatMemberResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    );
}

export default createGroupChatRoute;
