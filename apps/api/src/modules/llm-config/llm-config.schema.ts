import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const llmProviderConfigs = sqliteTable(
  "llm_provider_configs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    api: text("api").notNull().default("openai-chat-completions"),
    providerName: text("provider_name").notNull(),
    baseUrl: text("base_url").notNull(),
    model: text("model").notNull(),
    apiKeyCiphertext: text("api_key_ciphertext").notNull(),
    apiKeyIv: text("api_key_iv").notNull(),
    apiKeyLast4: text("api_key_last4").notNull(),
    disableThinking: integer("disable_thinking").notNull().default(0),
    isActive: integer("is_active").notNull().default(0),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    uniqueIndex("llm_provider_configs_active_unique")
      .on(table.isActive)
      .where(sql`${table.isActive} = 1`),
    index("llm_provider_configs_created_idx").on(table.createdAtMs),
    check(
      "llm_provider_configs_disable_thinking_check",
      sql`${table.disableThinking} IN (0, 1)`,
    ),
    check(
      "llm_provider_configs_is_active_check",
      sql`${table.isActive} IN (0, 1)`,
    ),
    check(
      "llm_provider_configs_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export type LlmProviderConfigRecord = typeof llmProviderConfigs.$inferSelect;
