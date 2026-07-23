import {
  BizCode,
  type LlmConfigCreateRequest,
  type LlmConfigListResponse,
  type LlmConfigMutationResponse,
  type LlmConfigTestRequest,
  type LlmConfigTestResponse,
  type LlmConfigUpdateRequest,
} from "@repo/contracts";

import { AppError } from "@/shared/app-error";
import { getApiEnv } from "@/shared/env";
import type { ApiBindings } from "@/shared/hono-env";

import {
  apiKeyLast4,
  decryptApiKey,
  encryptApiKey,
} from "./llm-config.crypto";
import { presentLlmConfig } from "./llm-config.presenter";
import {
  activateLlmConfig,
  deleteLlmConfig,
  findActiveLlmConfig,
  findLlmConfigById,
  findLlmConfigList,
  insertLlmConfig,
  updateLlmConfig,
} from "./llm-config.repository";
import type { LlmProviderConfigRecord } from "./llm-config.schema";

const TEST_TIMEOUT_MS = 15_000;

export interface ActiveLlmProviderConfig {
  apiKey: string;
  baseURL: string;
  disableThinking: boolean;
  model: string;
  providerName: string;
}

export async function listLlmConfigs(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
}): Promise<LlmConfigListResponse> {
  assertCanManageLlmConfig(input.adminRoles);
  const records = await findLlmConfigList(input.bindings.DB);

  return { items: records.map(presentLlmConfig) };
}

export async function createLlmConfig(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  payload: LlmConfigCreateRequest;
}): Promise<LlmConfigMutationResponse> {
  assertCanManageLlmConfig(input.adminRoles);
  const masterKey = getApiEnv(input.bindings).LLM_CONFIG_ENC_KEY;
  const encrypted = await encryptApiKey(masterKey, input.payload.apiKey);
  const nowMs = Date.now();

  const id = await insertLlmConfig({
    apiKeyCiphertext: encrypted.ciphertext,
    apiKeyIv: encrypted.iv,
    apiKeyLast4: apiKeyLast4(input.payload.apiKey),
    baseUrl: normalizeBaseURL(input.payload.baseURL),
    database: input.bindings.DB,
    disableThinking: input.payload.disableThinking,
    model: input.payload.model,
    name: input.payload.name,
    nowMs,
    providerName: input.payload.providerName,
  });

  const record = await findLlmConfigById(input.bindings.DB, id);

  if (!record) {
    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "模型配置创建后无法读取，请刷新列表",
      500,
    );
  }

  return { config: presentLlmConfig(record) };
}

export async function updateLlmConfigById(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  id: string;
  payload: LlmConfigUpdateRequest;
}): Promise<LlmConfigMutationResponse> {
  assertCanManageLlmConfig(input.adminRoles);
  const existing = await requireLlmConfig(input.bindings, input.id);
  const nowMs = Date.now();

  let encryptedFields: {
    apiKeyCiphertext?: string;
    apiKeyIv?: string;
    apiKeyLast4?: string;
  } = {};

  if (input.payload.apiKey !== undefined) {
    const masterKey = getApiEnv(input.bindings).LLM_CONFIG_ENC_KEY;
    const encrypted = await encryptApiKey(masterKey, input.payload.apiKey);
    encryptedFields = {
      apiKeyCiphertext: encrypted.ciphertext,
      apiKeyIv: encrypted.iv,
      apiKeyLast4: apiKeyLast4(input.payload.apiKey),
    };
  }

  await updateLlmConfig({
    ...encryptedFields,
    baseUrl:
      input.payload.baseURL !== undefined
        ? normalizeBaseURL(input.payload.baseURL)
        : undefined,
    database: input.bindings.DB,
    disableThinking: input.payload.disableThinking,
    id: existing.id,
    model: input.payload.model,
    name: input.payload.name,
    nowMs,
    providerName: input.payload.providerName,
  });

  const record = await requireLlmConfig(input.bindings, input.id);

  return { config: presentLlmConfig(record) };
}

export async function activateLlmConfigById(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  id: string;
}): Promise<LlmConfigMutationResponse> {
  assertCanManageLlmConfig(input.adminRoles);
  const existing = await requireLlmConfig(input.bindings, input.id);

  await activateLlmConfig({
    database: input.bindings.DB,
    id: existing.id,
    nowMs: Date.now(),
  });

  const record = await requireLlmConfig(input.bindings, input.id);

  return { config: presentLlmConfig(record) };
}

export async function deleteLlmConfigById(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  id: string;
}): Promise<{ success: true }> {
  assertCanManageLlmConfig(input.adminRoles);
  await requireLlmConfig(input.bindings, input.id);
  await deleteLlmConfig({ database: input.bindings.DB, id: input.id });

  return { success: true };
}

export async function testLlmConfig(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  payload: LlmConfigTestRequest;
}): Promise<LlmConfigTestResponse> {
  assertCanManageLlmConfig(input.adminRoles);
  const apiKey = await resolveTestApiKey(input.bindings, input.payload);
  const baseURL = normalizeBaseURL(input.payload.baseURL);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.payload.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const detail = await safeReadError(response);
      return {
        ok: false,
        latencyMs,
        message: `上游返回 ${response.status}${detail ? `：${detail}` : ""}`,
      };
    }

    return { ok: true, latencyMs, message: "连接成功" };
  } catch (error) {
    if (controller.signal.aborted) {
      return { ok: false, message: "连接超时，请检查 Base URL 与网络" };
    }

    return {
      ok: false,
      message:
        error instanceof Error && error.message
          ? error.message
          : "无法连接模型服务",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveActiveLlmProviderConfig(
  bindings: ApiBindings,
): Promise<ActiveLlmProviderConfig> {
  const record = await findActiveLlmConfig(bindings.DB);

  if (!record) {
    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "尚未配置可用模型，请在管理后台新建并激活一条模型配置",
      503,
    );
  }

  const masterKey = getApiEnv(bindings).LLM_CONFIG_ENC_KEY;
  const apiKey = await decryptApiKey(masterKey, {
    ciphertext: record.apiKeyCiphertext,
    iv: record.apiKeyIv,
  });

  return {
    apiKey,
    baseURL: record.baseUrl,
    disableThinking: record.disableThinking === 1,
    model: record.model,
    providerName: record.providerName,
  };
}

async function resolveTestApiKey(
  bindings: ApiBindings,
  payload: LlmConfigTestRequest,
): Promise<string> {
  if (payload.apiKey) {
    return payload.apiKey;
  }

  if (!payload.configId) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "请填写 API Key，或提供已有配置的 configId 以复用原 Key",
      400,
    );
  }

  const record = await requireLlmConfig(bindings, payload.configId);
  const masterKey = getApiEnv(bindings).LLM_CONFIG_ENC_KEY;

  return decryptApiKey(masterKey, {
    ciphertext: record.apiKeyCiphertext,
    iv: record.apiKeyIv,
  });
}

async function requireLlmConfig(
  bindings: ApiBindings,
  id: string,
): Promise<LlmProviderConfigRecord> {
  const record = await findLlmConfigById(bindings.DB, id);

  if (!record) {
    throw new AppError(
      BizCode.COMMON_NOT_FOUND,
      "没有找到这条模型配置，刷新列表后重试",
      404,
    );
  }

  return record;
}

function assertCanManageLlmConfig(adminRoles: readonly string[]) {
  if (!adminRoles.includes("admin_owner")) {
    throw new AppError(BizCode.AUTH_FORBIDDEN, "没有模型配置管理权限", 403);
  }
}

function normalizeBaseURL(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return "";
  }
}
