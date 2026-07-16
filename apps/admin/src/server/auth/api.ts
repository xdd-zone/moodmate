import {
  AdminAuthTokenResponseSchema,
  AdminLogoutResponseSchema,
  AdminSessionSchema,
  createApiResponseSchema,
  type AdminLogoutRequest,
  type AdminPasswordLoginRequest,
  type AdminRefreshRequest,
} from "@repo/contracts";
import type { z } from "zod";

import { getAdminServerEnv } from "@/src/env/server";

async function requestAuthApi<TData>(
  path: string,
  responseSchema: z.ZodType<TData>,
  init?: RequestInit,
) {
  const url = new URL(path, getAdminServerEnv().API_BASE_URL);
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new Error("无法连接认证服务，请确认 API 已启动", { cause: error });
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch (error) {
    throw new Error("认证服务返回的内容不是有效 JSON", { cause: error });
  }

  const result = createApiResponseSchema(responseSchema).safeParse(body);
  if (!result.success) {
    throw new Error("认证服务返回的数据结构无效", { cause: result.error });
  }

  return {
    body: result.data,
    status: response.status,
  };
}

function jsonPostInit(payload: unknown, authorization?: string): RequestInit {
  return {
    body: JSON.stringify(payload),
    headers: {
      ...(authorization ? { authorization } : {}),
      "content-type": "application/json",
    },
    method: "POST",
  };
}

export function loginAdmin(payload: AdminPasswordLoginRequest) {
  return requestAuthApi(
    "/auth/admin/password/login",
    AdminAuthTokenResponseSchema,
    jsonPostInit(payload),
  );
}

export function refreshAdmin(payload: AdminRefreshRequest) {
  return requestAuthApi(
    "/auth/admin/token/refresh",
    AdminAuthTokenResponseSchema,
    jsonPostInit(payload),
  );
}

export function getAdminSession(accessToken: string) {
  return requestAuthApi("/auth/admin/session", AdminSessionSchema, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

export function logoutAdmin(payload: AdminLogoutRequest, accessToken?: string) {
  return requestAuthApi(
    "/auth/admin/logout",
    AdminLogoutResponseSchema,
    jsonPostInit(payload, accessToken ? `Bearer ${accessToken}` : undefined),
  );
}
