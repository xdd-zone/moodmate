import { zValidator } from "@hono/zod-validator";
import {
  BizCode,
  UserCreateRequestSchema,
  UserListQuerySchema,
  UserListResponseSchema,
  UserMutationResponseSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";

import { requireAdminAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import { createUser, listUsers } from "./user.service";

export function createUserRoute() {
  return new Hono<ApiHonoEnv>()
    .get(
      "/rpc/admin/users",
      requireAdminAccess,
      zValidator("query", UserListQuerySchema, (result) => {
        if (result.success) return;
        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "用户参数无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const result = await listUsers({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          query: c.req.valid("query"),
        });
        const data = UserListResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/rpc/admin/users",
      requireAdminAccess,
      zValidator("json", UserCreateRequestSchema, (result) => {
        if (result.success) return;
        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "用户参数无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const result = await createUser({
          adminRoles: c.var.adminSession.roles,
          bindings: c.env,
          payload: c.req.valid("json"),
        });
        const data = UserMutationResponseSchema.parse(result);

        return c.json(buildSuccess(data, createMeta(c.var.requestId)), 201);
      },
    );
}

export default createUserRoute;
