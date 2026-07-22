import { zValidator } from "@hono/zod-validator";
import {
  AdminDefaultAvatarSetCurrentRequestSchema,
  BizCode,
  DefaultAvatarReadQuerySchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";

import { requireAdminAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import {
  getCurrentDefaultAvatar,
  getDefaultAvatar,
  getDefaultAvatarHistory,
  setCurrentDefaultAvatar,
  uploadDefaultAvatar,
} from "./assets.service";
import { readAvatarFile } from "./avatar-upload";

export function createAssetsRoute() {
  return new Hono<ApiHonoEnv>()
    .post("/rpc/admin/default-avatars", requireAdminAccess, async (c) => {
      const avatarFile = await readAvatarFile(c.req.raw);
      const result = await uploadDefaultAvatar({
        bindings: c.env,
        createdByUserId: c.var.adminSession.userId,
        file: avatarFile,
      });

      return c.json(buildSuccess(result, createMeta(c.var.requestId)), 201);
    })
    .get(
      "/rpc/admin/default-avatars/current",
      requireAdminAccess,
      async (c) => {
        const result = await getCurrentDefaultAvatar(c.env.DB);

        return c.json(buildSuccess(result, createMeta(c.var.requestId)));
      },
    )
    .get(
      "/rpc/admin/default-avatars/history",
      requireAdminAccess,
      async (c) => {
        const result = await getDefaultAvatarHistory(c.env.DB);

        return c.json(buildSuccess(result, createMeta(c.var.requestId)));
      },
    )
    .post(
      "/rpc/admin/default-avatars/:versionId/current",
      requireAdminAccess,
      zValidator(
        "param",
        AdminDefaultAvatarSetCurrentRequestSchema,
        (result) => {
          if (result.success) {
            return;
          }

          throw new AppError(
            BizCode.COMMON_INVALID_REQUEST,
            "默认头像版本 id 无效",
            400,
            result.error.issues,
          );
        },
      ),
      async (c) => {
        const result = await setCurrentDefaultAvatar({
          database: c.env.DB,
          versionId: c.req.valid("param").versionId,
        });

        return c.json(buildSuccess(result, createMeta(c.var.requestId)));
      },
    )
    .get(
      "/rpc/assets/avatar",
      zValidator("query", DefaultAvatarReadQuerySchema, (result) => {
        if (result.success) {
          return;
        }

        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "头像 key 无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const object = await getDefaultAvatar(
          c.env.AVATAR_BUCKET,
          c.req.valid("query").key,
        );
        const headers = new Headers();

        object.writeHttpMetadata(headers);
        headers.set("content-length", String(object.size));
        headers.set("etag", object.httpEtag);

        return new Response(object.body, { headers });
      },
    );
}

export default createAssetsRoute;
