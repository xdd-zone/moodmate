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
  })
  .refine((value) => Boolean(value.apiKey) || Boolean(value.configId), {
    message: "请填写 API Key，或提供已有配置的 configId 以复用原 Key",
  });

export type LlmConfigTestRequest = z.infer<typeof LlmConfigTestRequestSchema>;

export const LlmConfigTestResponseSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number().int().nonnegative().optional(),
  message: z.string().optional(),
});

export type LlmConfigTestResponse = z.infer<typeof LlmConfigTestResponseSchema>;
