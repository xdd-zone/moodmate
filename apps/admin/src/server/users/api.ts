import {
  createApiResponseSchema,
  UserCreateRequestSchema,
  UserListQuerySchema,
  UserListResponseSchema,
  UserMutationResponseSchema,
  type UserCreateRequest,
  type UserListQuery,
} from "@repo/contracts";
import type { z } from "zod";

import { getAdminServerEnv } from "@/src/env/server";

async function requestUsersApi<TData>(
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
    throw new Error("用户服务返回的数据结构无效", { cause: result.error });
  }

  return { body: result.data, status: response.status };
}

export function listUsers(accessToken: string, query: UserListQuery) {
  const parsedQuery = UserListQuerySchema.parse(query);
  const searchParams = new URLSearchParams({
    page: String(parsedQuery.page),
    pageSize: String(parsedQuery.pageSize),
  });

  if (parsedQuery.keyword) {
    searchParams.set("keyword", parsedQuery.keyword);
  }

  if (parsedQuery.status) {
    searchParams.set("status", parsedQuery.status);
  }

  return requestUsersApi(
    `/rpc/admin/users?${searchParams.toString()}`,
    UserListResponseSchema,
    accessToken,
  );
}

export function createUser(accessToken: string, payload: UserCreateRequest) {
  const data = UserCreateRequestSchema.parse(payload);

  return requestUsersApi(
    "/rpc/admin/users",
    UserMutationResponseSchema,
    accessToken,
    {
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
}
