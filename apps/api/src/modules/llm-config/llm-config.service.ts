import {
  BizCode,
  DEFAULT_LLM_CONFIG_API,
  type LlmConfigApi,
  LlmConfigApiSchema,
  type LlmConfigCreateRequest,
  type LlmConfigListResponse,
  type LlmConfigMutationResponse,
  type LlmConfigTestCheck,
  type LlmConfigTestCheckId,
  type LlmConfigTestRequest,
  type LlmConfigTestResponse,
  type LlmConfigUpdateRequest,
} from "@repo/contracts";
import { z } from "zod";

import {
  AiError,
  type AiEventStream,
  type AiModel,
  type AiStructuredOutputMethod,
  generateObject,
  generateText,
  streamText,
} from "@/infra/ai";
import { createAiCallObserver } from "@/modules/ai-usage";
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
 * 能力检测用的最小 schema。刻意保留 enum、数值区间和数组上限，
 * 因为部分上游对这些 JSON Schema 关键字或 strict 模式支持不一致。
 */
const PROBE_SCHEMA = z.object({
  mood: z.enum(["calm", "tired"]),
  score: z.number().min(0).max(1),
  tags: z.array(z.string()).max(2),
});

const PROBE_MESSAGES = [
  {
    role: "system" as const,
    content:
      "把用户这句话判断成结构化结果：mood 取 calm 或 tired，score 是 0 到 1 的把握度，tags 最多两个短标签。",
  },
  { role: "user" as const, content: "今天有点累，不太想说话" },
];

/**
 * 已解密的活动模型连接形状，字段与 design.md 的 AiModel 对齐。
 * 阶段 2 建好 `@/infra/ai` 类型后，可再对齐或替换为 AiModel。
 * apiKey 只存在于请求期内存，不写入事件、错误 metadata 或持久化日志。
 */
export interface ResolvedLlmConnection {
  id: string;
  api: LlmConfigApi;
  providerName: string;
  model: string;
  baseURL: string;
  apiKey: string;
  providerOptions?: {
    "openai-chat-completions"?: {
      disableThinking?: boolean;
    };
    "openai-responses"?: {
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
    disableThinking: input.payload.disableThinking ?? false,
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
  adminUserId: string;
  adminRoles: readonly string[];
  bindings: ApiBindings;
  payload: LlmConfigTestRequest;
  requestId: string;
}): Promise<LlmConfigTestResponse> {
  assertCanManageLlmConfig(input.adminRoles);
  const apiKey = await resolveTestApiKey(input.bindings, input.payload);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  const startedAt = Date.now();
  const api = input.payload.api ?? DEFAULT_LLM_CONFIG_API;
  const model: AiModel = {
    api,
    providerName: input.payload.providerName,
    model: input.payload.model,
    baseURL: normalizeBaseURL(input.payload.baseURL),
    apiKey,
    ...(api === "openai-chat-completions" || api === "openai-responses"
      ? {
          providerOptions: {
            [api]: { disableThinking: input.payload.disableThinking ?? false },
          },
        }
      : {}),
  };

  const newObserver = () =>
    createAiCallObserver({
      bindings: input.bindings,
      conversationType: "none",
      initiatorId: input.adminUserId,
      initiatorType: "admin",
      llmConfigId: input.payload.configId,
      model,
      requestId: input.requestId,
      scenario: "llm_config_test",
      subjectType: "system",
    });

  try {
    // 连通性先单独跑：失败时后面几项没有意义，直接短路，避免白发请求。
    const connectivity = await runTestCheck(
      "connectivity",
      controller.signal,
      () =>
        generateText({
          model,
          messages: [{ role: "user", content: "ping" }],
          maxTokens: 16,
          observer: newObserver(),
          signal: controller.signal,
        }),
    );

    if (!connectivity.ok) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: connectivity.message ?? "无法连接模型服务",
        checks: [connectivity],
      };
    }

    const [streaming, ...structured] = await Promise.all([
      runTestCheck("streaming", controller.signal, () =>
        consumeStream(
          streamText({
            model,
            messages: [{ role: "user", content: "说一句十个字以内的问候" }],
            maxTokens: 64,
            observer: newObserver(),
            signal: controller.signal,
          }),
        ),
      ),
      ...(["json_schema", "function", "json_object"] as const).map((method) =>
        runTestCheck(method, controller.signal, () =>
          probeStructuredOutput(
            method,
            model,
            newObserver(),
            controller.signal,
          ),
        ),
      ),
    ]);

    const checks = [connectivity, streaming, ...structured];

    return {
      ok: streaming.ok,
      latencyMs: Date.now() - startedAt,
      message: describeTestResult(streaming, structured),
      checks,
    };
  } catch (error) {
    return toTestFailureResponse(error, controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 跑单项检测，把异常收敛成检测结果，不让一项失败中断整轮。 */
async function runTestCheck(
  id: LlmConfigTestCheckId,
  signal: AbortSignal,
  run: () => Promise<unknown>,
): Promise<LlmConfigTestCheck> {
  const startedAt = Date.now();

  try {
    await run();

    return { id, ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      id,
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: toCheckFailureMessage(error, signal),
    };
  }
}

/** 只测指定的一种 structured output 方法，输出还要能过 Zod 才算通过。 */
async function probeStructuredOutput(
  method: AiStructuredOutputMethod,
  model: AiModel,
  observer: ReturnType<typeof createAiCallObserver>,
  signal: AbortSignal,
): Promise<void> {
  await generateObject({
    model,
    messages: [...PROBE_MESSAGES],
    schema: PROBE_SCHEMA,
    schemaName: "llm_config_probe",
    maxTokens: 600,
    methods: [method],
    observer,
    signal,
  });
}

/** 消费完整事件流；上游发出 error 事件时抛出，交给 runTestCheck 记为失败。 */
async function consumeStream(stream: AiEventStream): Promise<void> {
  for await (const event of stream) {
    if (event.type === "error") {
      throw event.error;
    }
  }
}

/** 汇总一句管理端可读的结论，说明哪些结构化方法可用。 */
function describeTestResult(
  streaming: LlmConfigTestCheck,
  structured: readonly LlmConfigTestCheck[],
): string {
  if (!streaming.ok) {
    return `连接成功，但流式输出不可用：${streaming.message ?? "未知原因"}`;
  }

  const usable = structured
    .filter((check) => check.ok)
    .map((check) => check.id);

  if (usable.length === 0) {
    return "连接与流式输出正常。三种结构化输出方法都不支持，分析类调用会退到纯文本加本地解析。";
  }

  return `连接与流式输出正常。可用的结构化输出方法：${usable.join("、")}。`;
}

/** 把连接测试异常转成管理端可读的失败响应，不暴露 API Key 与上游原始错误体。 */
function toTestFailureResponse(
  error: unknown,
  signal: AbortSignal,
): LlmConfigTestResponse {
  return {
    ok: false,
    message: toCheckFailureMessage(error, signal),
    checks: [],
  };
}

/** 单项检测的失败原因转管理端可读短句。 */
function toCheckFailureMessage(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) {
    return "请求超时，请检查 Base URL 与网络";
  }

  if (error instanceof AiError) {
    return describeAiError(error);
  }

  return error instanceof Error && error.message
    ? error.message
    : "无法连接模型服务";
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

  const api = normalizeLlmConfigApi(record.api);

  return {
    id: record.id,
    api,
    providerName: record.providerName,
    model: record.model,
    baseURL: record.baseUrl,
    apiKey,
    ...(api === "openai-chat-completions" || api === "openai-responses"
      ? {
          providerOptions: {
            [api]: { disableThinking: record.disableThinking === 1 },
          },
        }
      : {}),
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
