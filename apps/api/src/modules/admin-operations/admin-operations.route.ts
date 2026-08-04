import { zValidator } from "@hono/zod-validator";
import {
  AdminAiCallListQuerySchema,
  AdminAiCallListResponseSchema,
  AdminAgentDetailResponseSchema,
  AdminAgentListQuerySchema,
  AdminAgentListResponseSchema,
  AdminMessageFeedbackDetailResponseSchema,
  AdminMessageFeedbackListQuerySchema,
  AdminMessageFeedbackListResponseSchema,
  AdminMessageFeedbackUpdateRequestSchema,
  AdminMessageFeedbackUpdateResponseSchema,
  AdminOverviewResponseSchema,
  AdminSystemAgentDeleteResponseSchema,
  AdminSystemAgentMutationRequestSchema,
  AdminSystemAgentMutationResponseSchema,
  AdminSystemAgentUpdateRequestSchema,
  AdminUserAiUsageResponseSchema,
  AdminUserDetailResponseSchema,
  BizCode,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";
import { z } from "zod";
import { requireAdminAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";
import * as service from "./admin-operations.service";
const userParam = z.object({ userId: z.uuid() });
const agentParam = z.object({ agentId: z.uuid() });
const feedbackParam = z.object({ feedbackId: z.uuid() });
function invalid(message: string, details?: unknown) {
  return new AppError(BizCode.COMMON_INVALID_REQUEST, message, 400, details);
}
export function createAdminOperationsRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/rpc/admin/overview", requireAdminAccess, async (c) =>
      c.json(
        buildSuccess(
          AdminOverviewResponseSchema.parse(
            await service.getAdminOverview({
              adminRoles: c.var.adminSession.roles,
              bindings: c.env,
            }),
          ),
          createMeta(c.var.requestId),
        ),
      ),
    )
    .get(
      "/rpc/admin/users/:userId",
      requireAdminAccess,
      zValidator("param", userParam, (r) => {
        if (!r.success) throw invalid("用户 ID 无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            AdminUserDetailResponseSchema.parse(
              await service.getAdminUserDetail({
                adminRoles: c.var.adminSession.roles,
                bindings: c.env,
                userId: c.req.valid("param").userId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .get(
      "/rpc/admin/users/:userId/ai-usage",
      requireAdminAccess,
      zValidator("param", userParam, (r) => {
        if (!r.success) throw invalid("用户 ID 无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            AdminUserAiUsageResponseSchema.parse(
              await service.getAdminUserUsage({
                adminRoles: c.var.adminSession.roles,
                bindings: c.env,
                userId: c.req.valid("param").userId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .get(
      "/rpc/admin/users/:userId/ai-calls",
      requireAdminAccess,
      zValidator("param", userParam, (r) => {
        if (!r.success) throw invalid("用户 ID 无效", r.error.issues);
      }),
      zValidator("query", AdminAiCallListQuerySchema, (r) => {
        if (!r.success) throw invalid("调用筛选条件无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            AdminAiCallListResponseSchema.parse(
              await service.getAdminUserCalls({
                adminRoles: c.var.adminSession.roles,
                bindings: c.env,
                userId: c.req.valid("param").userId,
                query: c.req.valid("query"),
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .get(
      "/rpc/admin/agents",
      requireAdminAccess,
      zValidator("query", AdminAgentListQuerySchema, (r) => {
        if (!r.success) throw invalid("朋友筛选条件无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            AdminAgentListResponseSchema.parse(
              await service.getAdminAgents({
                adminRoles: c.var.adminSession.roles,
                bindings: c.env,
                query: c.req.valid("query"),
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .get(
      "/rpc/admin/agents/:agentId",
      requireAdminAccess,
      zValidator("param", agentParam, (r) => {
        if (!r.success) throw invalid("朋友 ID 无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            AdminAgentDetailResponseSchema.parse(
              await service.getAdminAgentDetail({
                adminRoles: c.var.adminSession.roles,
                bindings: c.env,
                agentId: c.req.valid("param").agentId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .post(
      "/rpc/admin/agents/system",
      requireAdminAccess,
      zValidator("json", AdminSystemAgentMutationRequestSchema, (r) => {
        if (!r.success) throw invalid("系统朋友内容无效", r.error.issues);
      }),
      async (c) => {
        const result = await service.createAdminSystemAgent({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          payload: c.req.valid("json"),
        });
        return c.json(
          buildSuccess(
            AdminSystemAgentMutationResponseSchema.parse({
              agent: result.agent,
            }),
            createMeta(c.var.requestId),
          ),
          201,
        );
      },
    )
    .patch(
      "/rpc/admin/agents/system/:agentId",
      requireAdminAccess,
      zValidator("param", agentParam, (r) => {
        if (!r.success) throw invalid("朋友 ID 无效", r.error.issues);
      }),
      zValidator("json", AdminSystemAgentUpdateRequestSchema, (r) => {
        if (!r.success) throw invalid("系统朋友内容无效", r.error.issues);
      }),
      async (c) => {
        const result = await service.updateAdminSystemAgent({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          agentId: c.req.valid("param").agentId,
          payload: c.req.valid("json"),
        });
        return c.json(
          buildSuccess(
            AdminSystemAgentMutationResponseSchema.parse({
              agent: result.agent,
            }),
            createMeta(c.var.requestId),
          ),
        );
      },
    )
    .post(
      "/rpc/admin/agents/system/:agentId/disable",
      requireAdminAccess,
      zValidator("param", agentParam, (r) => {
        if (!r.success) throw invalid("朋友 ID 无效", r.error.issues);
      }),
      async (c) => {
        const result = await service.setAdminSystemAgentStatus({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          agentId: c.req.valid("param").agentId,
          status: "disabled",
        });
        return c.json(
          buildSuccess(
            AdminSystemAgentMutationResponseSchema.parse({
              agent: result.agent,
            }),
            createMeta(c.var.requestId),
          ),
        );
      },
    )
    .post(
      "/rpc/admin/agents/system/:agentId/enable",
      requireAdminAccess,
      zValidator("param", agentParam, (r) => {
        if (!r.success) throw invalid("朋友 ID 无效", r.error.issues);
      }),
      async (c) => {
        const result = await service.setAdminSystemAgentStatus({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          agentId: c.req.valid("param").agentId,
          status: "active",
        });
        return c.json(
          buildSuccess(
            AdminSystemAgentMutationResponseSchema.parse({
              agent: result.agent,
            }),
            createMeta(c.var.requestId),
          ),
        );
      },
    )
    .delete(
      "/rpc/admin/agents/system/:agentId",
      requireAdminAccess,
      zValidator("param", agentParam, (r) => {
        if (!r.success) throw invalid("朋友 ID 无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            AdminSystemAgentDeleteResponseSchema.parse(
              await service.deleteAdminSystemAgent({
                adminRoles: c.var.adminSession.roles,
                bindings: c.env,
                agentId: c.req.valid("param").agentId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .get(
      "/rpc/admin/message-feedbacks",
      requireAdminAccess,
      zValidator("query", AdminMessageFeedbackListQuerySchema, (r) => {
        if (!r.success) throw invalid("反馈筛选条件无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            AdminMessageFeedbackListResponseSchema.parse(
              await service.getAdminFeedbacks({
                adminRoles: c.var.adminSession.roles,
                bindings: c.env,
                query: c.req.valid("query"),
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .get(
      "/rpc/admin/message-feedbacks/:feedbackId",
      requireAdminAccess,
      zValidator("param", feedbackParam, (r) => {
        if (!r.success) throw invalid("反馈 ID 无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            AdminMessageFeedbackDetailResponseSchema.parse(
              await service.getAdminFeedbackDetail({
                adminRoles: c.var.adminSession.roles,
                adminUserId: c.var.adminSession.userId,
                bindings: c.env,
                feedbackId: c.req.valid("param").feedbackId,
                requestId: c.var.requestId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .patch(
      "/rpc/admin/message-feedbacks/:feedbackId",
      requireAdminAccess,
      zValidator("param", feedbackParam, (r) => {
        if (!r.success) throw invalid("反馈 ID 无效", r.error.issues);
      }),
      zValidator("json", AdminMessageFeedbackUpdateRequestSchema, (r) => {
        if (!r.success) throw invalid("反馈状态无效", r.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            AdminMessageFeedbackUpdateResponseSchema.parse(
              await service.updateAdminFeedbackStatus({
                adminRoles: c.var.adminSession.roles,
                adminUserId: c.var.adminSession.userId,
                bindings: c.env,
                feedbackId: c.req.valid("param").feedbackId,
                payload: c.req.valid("json"),
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    );
}
