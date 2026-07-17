import { zValidator } from "@hono/zod-validator";
import {
  BizCode,
  RoleCreateRequestSchema,
  RoleMutationResponseSchema,
  RoleListResponseSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";
import { z } from "zod";

import { requireAdminAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import { createRole, deleteRole, disableRole, listRoles } from "./role.service";

const roleParamsSchema = z.object({ roleId: z.uuid() });

export function createRoleRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/rpc/admin/roles", requireAdminAccess, async (c) => {
      const result = await listRoles(c.env, c.var.adminSession.roles);
      const data = RoleListResponseSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)));
    })
    .post(
      "/rpc/admin/roles",
      requireAdminAccess,
      zValidator("json", RoleCreateRequestSchema, (result) => {
        if (result.success) {
          return;
        }

        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "角色参数无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const result = await createRole({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          payload: c.req.valid("json"),
        });
        const data = RoleMutationResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)), 201);
      },
    )
    .post(
      "/rpc/admin/roles/:roleId/disable",
      requireAdminAccess,
      zValidator("param", roleParamsSchema, (result) => {
        if (result.success) return;
        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "角色参数无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const result = await disableRole({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          roleId: c.req.valid("param").roleId,
        });

        return c.json(
          buildSuccess(
            RoleMutationResponseSchema.parse(result),
            createMeta(c.var.requestId),
          ),
        );
      },
    )
    .post(
      "/rpc/admin/roles/:roleId/delete",
      requireAdminAccess,
      zValidator("param", roleParamsSchema, (result) => {
        if (result.success) return;
        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "角色参数无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const result = await deleteRole({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          roleId: c.req.valid("param").roleId,
        });

        return c.json(
          buildSuccess(
            RoleMutationResponseSchema.parse(result),
            createMeta(c.var.requestId),
          ),
        );
      },
    );
}

export default createRoleRoute;
