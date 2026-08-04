import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { agents } from "@/modules/agents/agents.schema";
import { users } from "@/modules/auth/auth.schema";
import { llmProviderConfigs } from "@/modules/llm-config/llm-config.schema";

export const aiCallRecords = sqliteTable(
  "ai_call_records",
  {
    id: text("id").primaryKey(),
    operationId: text("operation_id").notNull(),
    attemptIndex: integer("attempt_index").notNull(),
    requestId: text("request_id").notNull(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    initiatorType: text("initiator_type", {
      enum: ["web_user", "admin", "system"],
    }).notNull(),
    initiatorId: text("initiator_id"),
    subjectType: text("subject_type", { enum: ["agent", "system"] }).notNull(),
    agentId: text("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    agentNameSnapshot: text("agent_name_snapshot"),
    agentSourceSnapshot: text("agent_source_snapshot", {
      enum: ["system", "user"],
    }),
    scenario: text("scenario").notNull(),
    conversationType: text("conversation_type", {
      enum: ["direct", "group", "none"],
    }).notNull(),
    conversationId: text("conversation_id"),
    llmConfigId: text("llm_config_id").references(() => llmProviderConfigs.id, {
      onDelete: "set null",
    }),
    api: text("api").notNull(),
    providerName: text("provider_name").notNull(),
    model: text("model").notNull(),
    structuredOutputMethod: text("structured_output_method", {
      enum: ["json_schema", "function", "json_object"],
    }),
    status: text("status", {
      enum: ["started", "completed", "failed", "aborted"],
    }).notNull(),
    usageStatus: text("usage_status", {
      enum: ["pending", "reported", "unavailable"],
    }).notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    finishReason: text("finish_reason"),
    errorCode: text("error_code"),
    /** 上游原始报错文本（截断），只用于排查协议层问题，不含 prompt 与模型回复。 */
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    startedAtMs: integer("started_at_ms").notNull(),
    finishedAtMs: integer("finished_at_ms"),
  },
  (table) => [
    unique("ai_call_records_operation_attempt_unique").on(
      table.operationId,
      table.attemptIndex,
    ),
    index("ai_call_records_user_started_idx").on(
      table.userId,
      table.startedAtMs,
    ),
    index("ai_call_records_user_agent_started_idx").on(
      table.userId,
      table.agentId,
      table.startedAtMs,
    ),
    index("ai_call_records_scenario_started_idx").on(
      table.scenario,
      table.startedAtMs,
    ),
    index("ai_call_records_status_started_idx").on(
      table.status,
      table.startedAtMs,
    ),
    index("ai_call_records_llm_config_started_idx").on(
      table.llmConfigId,
      table.startedAtMs,
    ),
    check("ai_call_records_attempt_check", sql`${table.attemptIndex} >= 0`),
    check(
      "ai_call_records_status_check",
      sql`${table.status} IN ('started', 'completed', 'failed', 'aborted')`,
    ),
    check(
      "ai_call_records_usage_status_check",
      sql`${table.usageStatus} IN ('pending', 'reported', 'unavailable')`,
    ),
    check(
      "ai_call_records_timestamps_check",
      sql`${table.finishedAtMs} IS NULL OR ${table.finishedAtMs} >= ${table.startedAtMs}`,
    ),
  ],
);

export type AiCallRecord = typeof aiCallRecords.$inferSelect;
