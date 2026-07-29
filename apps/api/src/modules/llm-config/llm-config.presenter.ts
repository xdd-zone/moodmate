import {
  DEFAULT_LLM_CONFIG_API,
  type LlmConfigApi,
  type LlmConfigItem,
  LlmConfigApiSchema,
} from "@repo/contracts";

import type { LlmProviderConfigRecord } from "./llm-config.schema";

function normalizeLlmConfigApi(value: string): LlmConfigApi {
  const parsed = LlmConfigApiSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_LLM_CONFIG_API;
}

export function presentLlmConfig(
  record: LlmProviderConfigRecord,
): LlmConfigItem {
  return {
    api: normalizeLlmConfigApi(record.api),
    apiKeyLast4: record.apiKeyLast4,
    baseURL: record.baseUrl,
    createdAtMs: record.createdAtMs,
    disableThinking: record.disableThinking === 1,
    id: record.id,
    isActive: record.isActive === 1,
    model: record.model,
    name: record.name,
    providerName: record.providerName,
    updatedAtMs: record.updatedAtMs,
  };
}
