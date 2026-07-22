import {
  AdminProfileAvatarReadQuerySchema,
  AdminProfileAvatarUploadResponseSchema,
  AdminProfileSchema,
  createApiResponseSchema,
} from "@repo/contracts";
import type { z } from "zod";

import { getAdminServerEnv } from "@/src/env/server";

async function requestProfileApi<TData>(
  path: string,
  responseSchema: z.ZodType<TData>,
  accessToken: string,
  init?: RequestInit,
) {
  const response = await fetch(
    new URL(path, getAdminServerEnv().API_BASE_URL),
    {
      ...init,
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    },
  );
  const body: unknown = await response.json();
  const result = createApiResponseSchema(responseSchema).safeParse(body);

  if (!result.success) {
    throw new Error("管理员资料服务返回的数据结构无效", {
      cause: result.error,
    });
  }

  return { body: result.data, status: response.status };
}

export function getProfile(accessToken: string) {
  return requestProfileApi(
    "/rpc/admin/profile",
    AdminProfileSchema,
    accessToken,
  );
}

export function uploadProfileAvatar(accessToken: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return requestProfileApi(
    "/rpc/admin/profile/avatar",
    AdminProfileAvatarUploadResponseSchema,
    accessToken,
    { body: formData, method: "POST" },
  );
}

export function getProfileAvatarImage(accessToken: string, key: string) {
  const query = AdminProfileAvatarReadQuerySchema.parse({ key });
  const url = new URL(
    "/rpc/admin/profile/avatar",
    getAdminServerEnv().API_BASE_URL,
  );
  url.searchParams.set("key", query.key);

  return fetch(url, {
    cache: "no-store",
    headers: { authorization: `Bearer ${accessToken}` },
  });
}
