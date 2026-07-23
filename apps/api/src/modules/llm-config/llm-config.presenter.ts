import type { LlmConfigItem } from "@repo/contracts";

import type { LlmProviderConfigRecord } from "./llm-config.schema";

export function presentLlmConfig(
  record: LlmProviderConfigRecord,
): LlmConfigItem {
  return {
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
