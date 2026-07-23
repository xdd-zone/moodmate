import {
  createApiResponseSchema,
  LlmConfigCreateRequestSchema,
  LlmConfigDeleteResponseSchema,
  LlmConfigListResponseSchema,
  LlmConfigMutationResponseSchema,
  LlmConfigTestRequestSchema,
  LlmConfigTestResponseSchema,
  LlmConfigUpdateRequestSchema,
  type LlmConfigCreateRequest,
  type LlmConfigTestRequest,
  type LlmConfigUpdateRequest,
} from "@repo/contracts";
import type { z } from "zod";

import { getAdminServerEnv } from "@/src/env/server";

async function requestLlmConfigsApi<TData>(
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
    throw new Error("模型配置服务返回的数据结构无效", { cause: result.error });
  }

  return { body: result.data, status: response.status };
}

export function listLlmConfigs(accessToken: string) {
  return requestLlmConfigsApi(
    "/rpc/admin/llm-configs",
    LlmConfigListResponseSchema,
    accessToken,
  );
}

export function createLlmConfig(
  accessToken: string,
  payload: LlmConfigCreateRequest,
) {
  const data = LlmConfigCreateRequestSchema.parse(payload);

  return requestLlmConfigsApi(
    "/rpc/admin/llm-configs",
    LlmConfigMutationResponseSchema,
    accessToken,
    {
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
}

export function updateLlmConfig(
  accessToken: string,
  configId: string,
  payload: LlmConfigUpdateRequest,
) {
  const data = LlmConfigUpdateRequestSchema.parse(payload);

  return requestLlmConfigsApi(
    `/rpc/admin/llm-configs/${configId}`,
    LlmConfigMutationResponseSchema,
    accessToken,
    {
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    },
  );
}

export function activateLlmConfig(accessToken: string, configId: string) {
  return requestLlmConfigsApi(
    `/rpc/admin/llm-configs/${configId}/activate`,
    LlmConfigMutationResponseSchema,
    accessToken,
    { method: "POST" },
  );
}

export function deleteLlmConfig(accessToken: string, configId: string) {
  return requestLlmConfigsApi(
    `/rpc/admin/llm-configs/${configId}/delete`,
    LlmConfigDeleteResponseSchema,
    accessToken,
    { method: "POST" },
  );
}

export function testLlmConfig(
  accessToken: string,
  payload: LlmConfigTestRequest,
) {
  const data = LlmConfigTestRequestSchema.parse(payload);

  return requestLlmConfigsApi(
    "/rpc/admin/llm-configs/test",
    LlmConfigTestResponseSchema,
    accessToken,
    {
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
}
