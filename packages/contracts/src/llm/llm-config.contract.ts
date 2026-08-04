import { z } from "zod";

export const LlmConfigBaseUrlSchema = z
  .url()
  .max(300)
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "Base URL 必须使用 HTTP 或 HTTPS",
  });

export const LlmConfigApiSchema = z.enum([
  "openai-chat-completions",
  "anthropic-messages",
  "openai-responses",
]);

export type LlmConfigApi = z.infer<typeof LlmConfigApiSchema>;

export const DEFAULT_LLM_CONFIG_API: LlmConfigApi = "openai-chat-completions";

export const LlmConfigItemSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  api: LlmConfigApiSchema,
  providerName: z.string().min(1).max(80),
  baseURL: z.string().min(1),
  model: z.string().min(1).max(120),
  apiKeyLast4: z.string().max(4),
  disableThinking: z.boolean(),
  isActive: z.boolean(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export type LlmConfigItem = z.infer<typeof LlmConfigItemSchema>;

export const LlmConfigListResponseSchema = z.object({
  items: z.array(LlmConfigItemSchema),
});

export type LlmConfigListResponse = z.infer<typeof LlmConfigListResponseSchema>;

export const LlmConfigCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  api: LlmConfigApiSchema.optional(),
  providerName: z.string().trim().min(1).max(80),
  baseURL: LlmConfigBaseUrlSchema,
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().min(1).max(400),
  disableThinking: z.boolean().optional(),
});

export type LlmConfigCreateRequest = z.infer<
  typeof LlmConfigCreateRequestSchema
>;

export const LlmConfigUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    api: LlmConfigApiSchema.optional(),
    providerName: z.string().trim().min(1).max(80).optional(),
    baseURL: LlmConfigBaseUrlSchema.optional(),
    model: z.string().trim().min(1).max(120).optional(),
    apiKey: z.string().trim().min(1).max(400).optional(),
    disableThinking: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "至少提供一个需要修改的字段",
  });

export type LlmConfigUpdateRequest = z.infer<
  typeof LlmConfigUpdateRequestSchema
>;

export const LlmConfigMutationResponseSchema = z.object({
  config: LlmConfigItemSchema,
});

export type LlmConfigMutationResponse = z.infer<
  typeof LlmConfigMutationResponseSchema
>;

export const LlmConfigDeleteResponseSchema = z.object({
  success: z.literal(true),
});

export type LlmConfigDeleteResponse = z.infer<
  typeof LlmConfigDeleteResponseSchema
>;

export const LlmConfigTestRequestSchema = z
  .object({
    configId: z.uuid().optional(),
    api: LlmConfigApiSchema.optional(),
    providerName: z.string().trim().min(1).max(80),
    baseURL: LlmConfigBaseUrlSchema,
    model: z.string().trim().min(1).max(120),
    apiKey: z.string().trim().min(1).max(400).optional(),
    disableThinking: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.apiKey) || Boolean(value.configId), {
    message: "请填写 API Key，或提供已有配置的 configId 以复用原 Key",
  });

export type LlmConfigTestRequest = z.infer<typeof LlmConfigTestRequestSchema>;

/**
 * 模型能力检测项。
 *
 * - `connectivity`：非流式最小请求，验证 Base URL、API Key、协议与模型名。
 * - `streaming`：流式请求，聊天回复依赖这一项。
 * - `json_schema` / `function` / `json_object`：三种结构化输出方法各测一次，
 *   结果同时要求输出能通过 Zod 校验。分析类调用按这个顺序降级使用。
 */
export const LlmConfigTestCheckIdSchema = z.enum([
  "connectivity",
  "streaming",
  "json_schema",
  "function",
  "json_object",
]);

export type LlmConfigTestCheckId = z.infer<typeof LlmConfigTestCheckIdSchema>;

export const LlmConfigTestCheckSchema = z.object({
  id: LlmConfigTestCheckIdSchema,
  ok: z.boolean(),
  latencyMs: z.number().int().nonnegative().optional(),
  message: z.string().optional(),
});

export type LlmConfigTestCheck = z.infer<typeof LlmConfigTestCheckSchema>;

/**
 * `ok` 只反映配置是否可用于聊天：连通性与流式必须都通过。
 * 三种结构化输出方法全部不支持时配置仍然可用，分析类调用会退到纯文本加本地解析，
 * 因此它们只作为能力清单展示。
 */
export const LlmConfigTestResponseSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number().int().nonnegative().optional(),
  message: z.string().optional(),
  checks: z.array(LlmConfigTestCheckSchema),
});

export type LlmConfigTestResponse = z.infer<typeof LlmConfigTestResponseSchema>;
