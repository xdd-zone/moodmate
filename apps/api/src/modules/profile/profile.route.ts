import { zValidator } from "@hono/zod-validator";
import {
  AdminProfileAvatarReadQuerySchema,
  AdminProfileAvatarUploadResponseSchema,
  AdminProfileSchema,
  BizCode,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";

import { readAvatarFile } from "@/modules/assets/avatar-upload";
import { requireAdminAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import {
  getAdminProfile,
  getAdminProfileAvatar,
  uploadAdminProfileAvatar,
} from "./profile.service";

export function createProfileRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/rpc/admin/profile", requireAdminAccess, async (c) => {
      const result = await getAdminProfile({
        bindings: c.env,
        userId: c.var.adminSession.userId,
      });
      const data = AdminProfileSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)));
    })
    .post("/rpc/admin/profile/avatar", requireAdminAccess, async (c) => {
      const result = await uploadAdminProfileAvatar({
        bindings: c.env,
        file: await readAvatarFile(c.req.raw),
        userId: c.var.adminSession.userId,
      });
      const data = AdminProfileAvatarUploadResponseSchema.parse(result);

      return c.json(buildSuccess(data, createMeta(c.var.requestId)), 201);
    })
    .get(
      "/rpc/admin/profile/avatar",
      requireAdminAccess,
      zValidator("query", AdminProfileAvatarReadQuerySchema, (result) => {
        if (result.success) return;

        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "头像 key 无效",
          400,
          result.error.issues,
        );
      }),
      async (c) => {
        const object = await getAdminProfileAvatar({
          bindings: c.env,
          key: c.req.valid("query").key,
          userId: c.var.adminSession.userId,
        });
        const headers = new Headers();

        object.writeHttpMetadata(headers);
        headers.set("cache-control", "private, max-age=31536000, immutable");
        headers.set("content-length", String(object.size));
        headers.set("etag", object.httpEtag);

        return new Response(object.body, { headers });
      },
    );
}

export default createProfileRoute;
