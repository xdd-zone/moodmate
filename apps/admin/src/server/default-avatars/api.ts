import {
  AdminDefaultAvatarCurrentResponseSchema,
  AdminDefaultAvatarHistoryResponseSchema,
  AdminDefaultAvatarSetCurrentRequestSchema,
  AdminDefaultAvatarSetCurrentResponseSchema,
  AdminDefaultAvatarUploadResponseSchema,
  DefaultAvatarReadQuerySchema,
  createApiResponseSchema,
} from "@repo/contracts";
import type { z } from "zod";

import { getAdminServerEnv } from "@/src/env/server";

async function requestDefaultAvatarsApi<TData>(
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
    throw new Error("默认头像服务返回的数据结构无效", {
      cause: result.error,
    });
  }

  return { body: result.data, status: response.status };
}

export function getCurrentDefaultAvatar(accessToken: string) {
  return requestDefaultAvatarsApi(
    "/rpc/admin/default-avatars/current",
    AdminDefaultAvatarCurrentResponseSchema,
    accessToken,
  );
}

export function getDefaultAvatarHistory(accessToken: string) {
  return requestDefaultAvatarsApi(
    "/rpc/admin/default-avatars/history",
    AdminDefaultAvatarHistoryResponseSchema,
    accessToken,
  );
}

export function uploadDefaultAvatar(accessToken: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return requestDefaultAvatarsApi(
    "/rpc/admin/default-avatars",
    AdminDefaultAvatarUploadResponseSchema,
    accessToken,
    { body: formData, method: "POST" },
  );
}

export function setCurrentDefaultAvatar(
  accessToken: string,
  versionId: string,
) {
  const input = AdminDefaultAvatarSetCurrentRequestSchema.parse({ versionId });

  return requestDefaultAvatarsApi(
    `/rpc/admin/default-avatars/${input.versionId}/current`,
    AdminDefaultAvatarSetCurrentResponseSchema,
    accessToken,
    { method: "POST" },
  );
}

export function getDefaultAvatarImage(key: string) {
  const query = DefaultAvatarReadQuerySchema.parse({ key });
  const url = new URL("/rpc/assets/avatar", getAdminServerEnv().API_BASE_URL);
  url.searchParams.set("key", query.key);

  return fetch(url, { cache: "no-store" });
}
