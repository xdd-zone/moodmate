import {
  BizCode,
  DEFAULT_LLM_CONFIG_API,
  type LlmConfigApi,
  LlmConfigApiSchema,
  type LlmConfigCreateRequest,
  type LlmConfigListResponse,
  type LlmConfigMutationResponse,
  type LlmConfigTestRequest,
  type LlmConfigTestResponse,
  type LlmConfigUpdateRequest,
} from "@repo/contracts";

import { AiError, generateText } from "@/infra/ai";
import { AppError } from "@/shared/app-error";
import { getApiEnv } from "@/shared/env";
import type { ApiBindings } from "@/shared/hono-env";

import { apiKeyLast4, decryptApiKey, encryptApiKey } from "./llm-config.crypto";
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

/**
 * 已解密的活动模型连接形状，字段与 design.md 的 AiModel 对齐。
 * 阶段 2 建好 `@/infra/ai` 类型后，可再对齐或替换为 AiModel。
 * apiKey 只存在于请求期内存，不写入事件、错误 metadata 或持久化日志。
 */
export interface ResolvedLlmConnection {
  api: LlmConfigApi;
  providerName: string;
  model: string;
  baseURL: string;
  apiKey: string;
  providerOptions?: {
    "openai-chat-completions"?: {
      disableThinking?: boolean;
    };
  };
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
    api: input.payload.api ?? DEFAULT_LLM_CONFIG_API,
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
    api: input.payload.api,
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    // 用最小非流式生成请求走 AI runtime，验证认证、协议和模型可用；
    // 不再在 llm-config 里自行 fetch 上游。
    await generateText({
      model: {
        api: input.payload.api ?? DEFAULT_LLM_CONFIG_API,
        providerName: input.payload.providerName,
        model: input.payload.model,
        baseURL: normalizeBaseURL(input.payload.baseURL),
        apiKey,
      },
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 1,
      signal: controller.signal,
    });

    return { ok: true, latencyMs: Date.now() - startedAt, message: "连接成功" };
  } catch (error) {
    return toTestFailureResponse(error, controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 把连接测试异常转成管理端可读的失败响应，不暴露 API Key 与上游原始错误体。 */
function toTestFailureResponse(
  error: unknown,
  signal: AbortSignal,
): LlmConfigTestResponse {
  if (signal.aborted) {
    return { ok: false, message: "连接超时，请检查 Base URL 与网络" };
  }

  if (error instanceof AiError) {
    return { ok: false, message: describeAiError(error) };
  }

  return {
    ok: false,
    message:
      error instanceof Error && error.message
        ? error.message
        : "无法连接模型服务",
  };
}

/** AiError 转管理端可读的中文短句。 */
function describeAiError(error: AiError): string {
  switch (error.code) {
    case "authentication":
      return "认证失败，请检查 API Key";
    case "permission_denied":
      return "模型服务拒绝访问，请检查权限与模型名";
    case "rate_limited":
      return "触发限流，请稍后重试";
    case "timeout":
      return "连接超时，请检查 Base URL 与网络";
    case "network":
      return "无法连接模型服务，请检查 Base URL 与网络";
    case "aborted":
      return "连接已取消";
    case "invalid_response":
      return `模型服务无法处理该请求${error.metadata.status ? `（${error.metadata.status}）` : ""}`;
    case "invalid_config":
      return "模型配置无效，请检查协议与参数";
    default:
      return `模型服务返回错误${error.metadata.status ? `（${error.metadata.status}）` : ""}`;
  }
}

export async function resolveActiveLlmProviderConfig(
  bindings: ApiBindings,
): Promise<ResolvedLlmConnection> {
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
    api: normalizeLlmConfigApi(record.api),
    providerName: record.providerName,
    model: record.model,
    baseURL: record.baseUrl,
    apiKey,
    providerOptions: {
      "openai-chat-completions": {
        disableThinking: record.disableThinking === 1,
      },
    },
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

function normalizeLlmConfigApi(value: string): LlmConfigApi {
  const parsed = LlmConfigApiSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_LLM_CONFIG_API;
}
