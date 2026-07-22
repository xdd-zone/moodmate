import { zValidator } from "@hono/zod-validator";
import {
  AdminLogoutRequestSchema,
  AdminPasswordLoginRequestSchema,
  AdminRefreshRequestSchema,
  BizCode,
  WebGithubTicketLoginRequestSchema,
  WebPasswordLoginRequestSchema,
  WebRefreshRequestSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";

import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";
import { requireAdminAccess, requireWebAccess } from "./auth.middleware";
import {
  getWebUserProfile,
  loginAdminWithPassword,
  loginWebWithPassword,
  logoutAdmin,
  refreshAdminSession,
  refreshWebSession,
} from "./auth.service";
import {
  buildWebGithubAuthUrl,
  handleWebGithubCallback,
  loginWebWithGithubTicket,
} from "./github-oauth.service";

export function createAuthRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/auth/web/github/authorize", async (c) => {
      const result = await buildWebGithubAuthUrl(c);

      return c.json(buildSuccess(result, createMeta(c.var.requestId)));
    })
    .get("/auth/web/github/callback", (c) => {
      return handleWebGithubCallback(c);
    })
    .post(
      "/auth/web/github/ticket/login",
      zValidator("json", WebGithubTicketLoginRequestSchema, (result) => {
        if (result.success) {
          return;
        }

        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "GitHub 登录参数无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const result = await loginWebWithGithubTicket({
          bindings: c.env,
          clientIp: c.req.header("CF-Connecting-IP"),
          ticket: c.req.valid("json").ticket,
          userAgent: c.req.header("User-Agent"),
        });

        return c.json(buildSuccess(result, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/auth/web/password/login",
      zValidator("json", WebPasswordLoginRequestSchema, (result) => {
        if (result.success) {
          return;
        }

        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "请求参数无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const result = await loginWebWithPassword({
          bindings: c.env,
          clientIp: c.req.header("CF-Connecting-IP"),
          payload: c.req.valid("json"),
          userAgent: c.req.header("User-Agent"),
        });

        return c.json(buildSuccess(result, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/auth/web/token/refresh",
      zValidator("json", WebRefreshRequestSchema, (result) => {
        if (result.success) {
          return;
        }

        if (!isRefreshTokenMissing(result.error.issues)) {
          throw new AppError(
            BizCode.COMMON_INVALID_REQUEST,
            "请求参数无效",
            400,
            result.error.issues,
          );
        }

        throw new AppError(
          BizCode.AUTH_REFRESH_MISSING,
          "缺少 refresh token",
          401,
        );
      }),
      async (c) => {
        const result = await refreshWebSession(
          c.env,
          c.req.valid("json").refreshToken,
        );

        return c.json(buildSuccess(result, createMeta(c.var.requestId)));
      },
    )
    .get("/rpc/user/profile", requireWebAccess, (c) => {
      return c.json(
        buildSuccess(
          getWebUserProfile(c.var.webSession),
          createMeta(c.var.requestId),
        ),
      );
    })
    .post(
      "/auth/admin/password/login",
      zValidator("json", AdminPasswordLoginRequestSchema, (result) => {
        if (result.success) {
          return;
        }

        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "请求参数无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const result = await loginAdminWithPassword({
          bindings: c.env,
          clientIp: c.req.header("CF-Connecting-IP"),
          payload: c.req.valid("json"),
          userAgent: c.req.header("User-Agent"),
        });

        return c.json(buildSuccess(result, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/auth/admin/token/refresh",
      zValidator("json", AdminRefreshRequestSchema, (result) => {
        if (result.success) {
          return;
        }

        if (!isRefreshTokenMissing(result.error.issues)) {
          throw new AppError(
            BizCode.COMMON_INVALID_REQUEST,
            "请求参数无效",
            400,
            result.error.issues,
          );
        }

        throw new AppError(
          BizCode.AUTH_REFRESH_MISSING,
          "缺少 refresh token",
          401,
        );
      }),
      async (c) => {
        const result = await refreshAdminSession(
          c.env,
          c.req.valid("json").refreshToken,
        );

        return c.json(buildSuccess(result, createMeta(c.var.requestId)));
      },
    )
    .get("/auth/admin/session", requireAdminAccess, (c) => {
      return c.json(
        buildSuccess(c.var.adminSession, createMeta(c.var.requestId)),
      );
    })
    .post(
      "/auth/admin/logout",
      zValidator("json", AdminLogoutRequestSchema, (result) => {
        if (result.success) {
          return;
        }

        if (!isRefreshTokenMissing(result.error.issues)) {
          throw new AppError(
            BizCode.COMMON_INVALID_REQUEST,
            "请求参数无效",
            400,
            result.error.issues,
          );
        }

        throw new AppError(
          BizCode.AUTH_REFRESH_MISSING,
          "缺少 refresh token",
          401,
        );
      }),
      async (c) => {
        const result = await logoutAdmin({
          authorization: c.req.header("Authorization"),
          bindings: c.env,
          refreshToken: c.req.valid("json").refreshToken,
        });

        return c.json(buildSuccess(result, createMeta(c.var.requestId)));
      },
    );
}

function isRefreshTokenMissing(
  issues: ReadonlyArray<{ code: string; path: PropertyKey[] }>,
): boolean {
  return issues.some(
    (issue) =>
      issue.path[0] === "refreshToken" &&
      (issue.code === "invalid_type" || issue.code === "too_small"),
  );
}

export default createAuthRoute;
