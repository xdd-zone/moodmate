import { zValidator } from "@hono/zod-validator";
import {
  BizCode,
  AgentDetailResponseSchema,
  AgentListResponseSchema,
  AgentMemoriesResponseSchema,
  CreateUserAgentRequestSchema,
  CreateUserAgentResponseSchema,
  DeleteAgentMemoryResponseSchema,
  DeleteUserAgentResponseSchema,
  UpdateAgentMemoryRequestSchema,
  UpdateAgentMemoryResponseSchema,
  UpdateUserAgentRequestSchema,
  UpdateUserAgentResponseSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";
import { z } from "zod";

import { requireWebAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import {
  archiveUserAgentForUser,
  createUserAgentForUser,
  deleteAgentMemoryForUser,
  getUserAgentDetail,
  listAgentMemoriesForUser,
  listUserAgentsForUser,
  updateAgentMemoryForUser,
  updateUserAgentForUser,
} from "./agents.service";

const agentParamsSchema = z.object({ agentId: z.uuid() });
const memoryParamsSchema = z.object({ memoryId: z.uuid() });
const memoryQuerySchema = z.object({ agentId: z.uuid() });

function invalidRequest(message: string, details?: unknown) {
  return new AppError(BizCode.COMMON_INVALID_REQUEST, message, 400, details);
}

export function createAgentsRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/rpc/agents", requireWebAccess, async (c) => {
      const result = await listUserAgentsForUser({
        bindings: c.env,
        userId: c.var.webSession.userId,
      });
      const data = AgentListResponseSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)));
    })
    .post(
      "/rpc/agents",
      requireWebAccess,
      zValidator("json", CreateUserAgentRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("Agent 内容无效", result.error.issues);
      }),
      async (c) => {
        const result = await createUserAgentForUser({
          bindings: c.env,
          payload: c.req.valid("json"),
          userId: c.var.webSession.userId,
        });
        const data = CreateUserAgentResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .get(
      "/rpc/agents/:agentId",
      requireWebAccess,
      zValidator("param", agentParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("Agent ID 无效", result.error.issues);
      }),
      async (c) => {
        const result = await getUserAgentDetail({
          agentId: c.req.valid("param").agentId,
          bindings: c.env,
          userId: c.var.webSession.userId,
        });
        const data = AgentDetailResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .patch(
      "/rpc/agents/:agentId",
      requireWebAccess,
      zValidator("param", agentParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("Agent ID 无效", result.error.issues);
      }),
      zValidator("json", UpdateUserAgentRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("Agent 内容无效", result.error.issues);
      }),
      async (c) => {
        const result = await updateUserAgentForUser({
          agentId: c.req.valid("param").agentId,
          bindings: c.env,
          patch: c.req.valid("json"),
          userId: c.var.webSession.userId,
        });
        const data = UpdateUserAgentResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .delete(
      "/rpc/agents/:agentId",
      requireWebAccess,
      zValidator("param", agentParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("Agent ID 无效", result.error.issues);
      }),
      async (c) => {
        const result = await archiveUserAgentForUser({
          agentId: c.req.valid("param").agentId,
          bindings: c.env,
          userId: c.var.webSession.userId,
        });
        const data = DeleteUserAgentResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .get(
      "/rpc/agent-memories",
      requireWebAccess,
      zValidator("query", memoryQuerySchema, (result) => {
        if (result.success) return;
        throw invalidRequest("朋友 ID 无效", result.error.issues);
      }),
      async (c) => {
        const result = await listAgentMemoriesForUser({
          agentId: c.req.valid("query").agentId,
          bindings: c.env,
          userId: c.var.webSession.userId,
        });
        const data = AgentMemoriesResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .patch(
      "/rpc/agent-memories/:memoryId",
      requireWebAccess,
      zValidator("param", memoryParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("记忆 ID 无效", result.error.issues);
      }),
      zValidator("query", memoryQuerySchema, (result) => {
        if (result.success) return;
        throw invalidRequest("朋友 ID 无效", result.error.issues);
      }),
      zValidator("json", UpdateAgentMemoryRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("记忆内容无效", result.error.issues);
      }),
      async (c) => {
        const result = await updateAgentMemoryForUser({
          agentId: c.req.valid("query").agentId,
          bindings: c.env,
          memoryId: c.req.valid("param").memoryId,
          patch: c.req.valid("json"),
          userId: c.var.webSession.userId,
        });
        const data = UpdateAgentMemoryResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .delete(
      "/rpc/agent-memories/:memoryId",
      requireWebAccess,
      zValidator("param", memoryParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("记忆 ID 无效", result.error.issues);
      }),
      zValidator("query", memoryQuerySchema, (result) => {
        if (result.success) return;
        throw invalidRequest("朋友 ID 无效", result.error.issues);
      }),
      async (c) => {
        const result = await deleteAgentMemoryForUser({
          agentId: c.req.valid("query").agentId,
          bindings: c.env,
          memoryId: c.req.valid("param").memoryId,
          userId: c.var.webSession.userId,
        });
        const data = DeleteAgentMemoryResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    );
}

export default createAgentsRoute;
