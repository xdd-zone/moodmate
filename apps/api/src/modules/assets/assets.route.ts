import { zValidator } from "@hono/zod-validator";
import {
  BizCode,
  DefaultAvatarReadQuerySchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";

import { requireAdminAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import { getDefaultAvatar, uploadDefaultAvatar } from "./assets.service";

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

async function readAvatarFile(request: Request): Promise<File> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "头像上传请求必须使用 multipart/form-data",
      400,
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, "缺少头像文件", 400);
  }

  return file;
}

export default createAssetsRoute;
