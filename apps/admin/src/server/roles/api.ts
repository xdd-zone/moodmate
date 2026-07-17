import {
  createApiResponseSchema,
  RoleCreateRequestSchema,
  RoleListResponseSchema,
  RoleMutationResponseSchema,
  type RoleCreateRequest,
} from "@repo/contracts";
import type { z } from "zod";

import { getAdminServerEnv } from "@/src/env/server";

async function requestRolesApi<TData>(
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
    throw new Error("角色服务返回的数据结构无效", { cause: result.error });
  }

  return { body: result.data, status: response.status };
}

export function listRoles(accessToken: string) {
  return requestRolesApi(
    "/rpc/admin/roles",
    RoleListResponseSchema,
    accessToken,
  );
}

export function createRole(accessToken: string, payload: RoleCreateRequest) {
  const data = RoleCreateRequestSchema.parse(payload);

  return requestRolesApi(
    "/rpc/admin/roles",
    RoleMutationResponseSchema,
    accessToken,
    {
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
}

export function disableRole(accessToken: string, roleId: string) {
  return requestRolesApi(
    `/rpc/admin/roles/${roleId}/disable`,
    RoleMutationResponseSchema,
    accessToken,
    { method: "POST" },
  );
}

export function deleteRole(accessToken: string, roleId: string) {
  return requestRolesApi(
    `/rpc/admin/roles/${roleId}/delete`,
    RoleMutationResponseSchema,
    accessToken,
    { method: "POST" },
  );
}
