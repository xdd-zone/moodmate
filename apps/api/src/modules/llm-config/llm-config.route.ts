import { zValidator } from "@hono/zod-validator";
import {
  BizCode,
  LlmConfigCreateRequestSchema,
  LlmConfigListResponseSchema,
  LlmConfigMutationResponseSchema,
  LlmConfigTestRequestSchema,
  LlmConfigTestResponseSchema,
  LlmConfigUpdateRequestSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import {
  activateLlmConfigById,
  createLlmConfig,
  deleteLlmConfigById,
  listLlmConfigs,
  testLlmConfig,
  updateLlmConfigById,
} from "./llm-config.service";

const llmConfigParamsSchema = z.object({ id: z.uuid() });
const DeleteLlmConfigResponseSchema = z.object({ success: z.literal(true) });

function invalidRequest(message: string, details?: unknown) {
  return new AppError(BizCode.COMMON_INVALID_REQUEST, message, 400, details);
}

export function createLlmConfigRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/rpc/admin/llm-configs", requireAdminAccess, async (c) => {
      const result = await listLlmConfigs({
        adminRoles: c.var.adminSession.roles,
        bindings: c.env,
      });
      const data = LlmConfigListResponseSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)));
    })
    .post(
      "/rpc/admin/llm-configs",
      requireAdminAccess,
      zValidator("json", LlmConfigCreateRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("模型配置参数无效", result.error.issues);
      }),
      async (c) => {
        const result = await createLlmConfig({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          payload: c.req.valid("json"),
        });
        const data = LlmConfigMutationResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)), 201);
      },
    )
    .post(
      "/rpc/admin/llm-configs/test",
      requireAdminAccess,
      zValidator("json", LlmConfigTestRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("测试参数无效", result.error.issues);
      }),
      async (c) => {
        const result = await testLlmConfig({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          payload: c.req.valid("json"),
        });
        const data = LlmConfigTestResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .patch(
      "/rpc/admin/llm-configs/:id",
      requireAdminAccess,
      zValidator("param", llmConfigParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("模型配置 ID 无效", result.error.issues);
      }),
      zValidator("json", LlmConfigUpdateRequestSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("模型配置参数无效", result.error.issues);
      }),
      async (c) => {
        const result = await updateLlmConfigById({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          id: c.req.valid("param").id,
          payload: c.req.valid("json"),
        });
        const data = LlmConfigMutationResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/rpc/admin/llm-configs/:id/activate",
      requireAdminAccess,
      zValidator("param", llmConfigParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("模型配置 ID 无效", result.error.issues);
      }),
      async (c) => {
        const result = await activateLlmConfigById({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          id: c.req.valid("param").id,
        });
        const data = LlmConfigMutationResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/rpc/admin/llm-configs/:id/delete",
      requireAdminAccess,
      zValidator("param", llmConfigParamsSchema, (result) => {
        if (result.success) return;
        throw invalidRequest("模型配置 ID 无效", result.error.issues);
      }),
      async (c) => {
        const result = await deleteLlmConfigById({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          id: c.req.valid("param").id,
        });
        const data = DeleteLlmConfigResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    );
}

export default createLlmConfigRoute;
