import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { users } from "@/modules/auth/auth.schema";

export const agents = sqliteTable(
  "agents",
  {
    id: text("id").primaryKey(),
    source: text("source", { enum: ["system", "user"] }).notNull(),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    headline: text("headline"),
    description: text("description"),
    storyBackground: text("story_background"),
    personaPrompt: text("persona_prompt"),
    tonePrompt: text("tone_prompt"),
    guardrailsPrompt: text("guardrails_prompt"),
    defaultPrompt: text("default_prompt"),
    imageKey: text("image_key"),
    status: text("status", {
      enum: ["active", "disabled", "archived"],
    }).notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("agents_source_status_updated_idx").on(
      table.source,
      table.status,
      table.updatedAtMs,
    ),
    index("agents_owner_status_updated_idx").on(
      table.ownerUserId,
      table.status,
      table.updatedAtMs,
    ),
    check("agents_source_check", sql`${table.source} IN ('system', 'user')`),
    check(
      "agents_owner_source_check",
      sql`(${table.source} = 'system' AND ${table.ownerUserId} IS NULL) OR (${table.source} = 'user' AND ${table.ownerUserId} IS NOT NULL)`,
    ),
    check(
      "agents_status_check",
      sql`(${table.source} = 'system' AND ${table.status} IN ('active', 'disabled')) OR (${table.source} = 'user' AND ${table.status} IN ('active', 'archived'))`,
    ),
    check(
      "agents_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const agentConversations = sqliteTable(
  "agent_conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    title: text("title"),
    summary: text("summary"),
    messageCount: integer("message_count").notNull().default(0),
    lastMessageAtMs: integer("last_message_at_ms"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("agent_conversations_user_agent_unique").on(
      table.userId,
      table.agentId,
    ),
    index("agent_conversations_user_updated_idx").on(
      table.userId,
      table.updatedAtMs,
    ),
    check(
      "agent_conversations_message_count_check",
      sql`${table.messageCount} >= 0`,
    ),
    check(
      "agent_conversations_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const agentConversationMessages = sqliteTable(
  "agent_conversation_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => agentConversations.id, { onDelete: "cascade" }),
    turnId: text("turn_id").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    status: text("status", { enum: ["completed", "failed"] }).notNull(),
    metadataJson: text("metadata_json"),
    createdAtMs: integer("created_at_ms").notNull(),
  },
  (table) => [
    index("agent_conversation_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAtMs,
      table.id,
    ),
    index("agent_conversation_messages_turn_idx").on(table.turnId),
    check(
      "agent_conversation_messages_role_check",
      sql`${table.role} IN ('user', 'assistant')`,
    ),
    check(
      "agent_conversation_messages_status_check",
      sql`${table.status} IN ('completed', 'failed')`,
    ),
  ],
);

export const agentMemories = sqliteTable(
  "agent_memories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    importance: integer("importance").notNull().default(3),
    status: text("status", {
      enum: ["active", "disabled", "deleted"],
    }).notNull(),
    sourceMessageId: text("source_message_id").references(
      () => agentConversationMessages.id,
      { onDelete: "set null" },
    ),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("agent_memories_user_agent_status_idx").on(
      table.userId,
      table.agentId,
      table.status,
      table.importance,
      table.updatedAtMs,
    ),
    check(
      "agent_memories_importance_check",
      sql`${table.importance} BETWEEN 1 AND 5`,
    ),
    check(
      "agent_memories_status_check",
      sql`${table.status} IN ('active', 'disabled', 'deleted')`,
    ),
    check(
      "agent_memories_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const agentMessageFeedbacks = sqliteTable(
  "agent_message_feedbacks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => agentConversations.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => agentConversationMessages.id, { onDelete: "cascade" }),
    turnId: text("turn_id").notNull(),
    rating: text("rating", { enum: ["positive", "negative"] }).notNull(),
    reason: text("reason"),
    note: text("note"),
    status: text("status", { enum: ["pending", "processed"] })
      .notNull()
      .default("pending"),
    processedByAdminUserId: text("processed_by_admin_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    processedAtMs: integer("processed_at_ms"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("agent_message_feedbacks_user_message_unique").on(
      table.userId,
      table.messageId,
    ),
    index("agent_message_feedbacks_status_updated_idx").on(
      table.status,
      table.updatedAtMs,
    ),
    check(
      "agent_message_feedbacks_rating_check",
      sql`${table.rating} IN ('positive', 'negative')`,
    ),
    check(
      "agent_message_feedbacks_status_check",
      sql`${table.status} IN ('pending', 'processed')`,
    ),
    check(
      "agent_message_feedbacks_processed_check",
      sql`(${table.status} = 'pending' AND ${table.processedAtMs} IS NULL) OR (${table.status} = 'processed' AND ${table.processedAtMs} IS NOT NULL)`,
    ),
    check(
      "agent_message_feedbacks_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const agentCarePlans = sqliteTable(
  "agent_care_plans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: text("agent_id").references(() => agents.id, {
      onDelete: "restrict",
    }),
    enabled: integer("enabled").notNull().default(0),
    frequency: text("frequency", {
      enum: ["daily", "weekly", "custom"],
    }).notNull(),
    preferredTime: text("preferred_time"),
    scenesJson: text("scenes_json").notNull(),
    tone: text("tone", { enum: ["light", "gentle", "intimate"] }).notNull(),
    customPrompt: text("custom_prompt"),
    nextRunAtMs: integer("next_run_at_ms"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("agent_care_plans_user_unique").on(table.userId),
    index("agent_care_plans_enabled_next_run_idx").on(
      table.enabled,
      table.nextRunAtMs,
    ),
    check(
      "agent_care_plans_enabled_agent_check",
      sql`${table.enabled} = 0 OR ${table.agentId} IS NOT NULL`,
    ),
    check("agent_care_plans_enabled_check", sql`${table.enabled} IN (0, 1)`),
    check(
      "agent_care_plans_frequency_check",
      sql`${table.frequency} IN ('daily', 'weekly', 'custom')`,
    ),
    check(
      "agent_care_plans_tone_check",
      sql`${table.tone} IN ('light', 'gentle', 'intimate')`,
    ),
    check(
      "agent_care_plans_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const agentCareEvents = sqliteTable(
  "agent_care_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    carePlanId: text("care_plan_id").references(() => agentCarePlans.id, {
      onDelete: "set null",
    }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => agentConversations.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => agentConversationMessages.id, { onDelete: "cascade" }),
    scene: text("scene").notNull(),
    status: text("status", { enum: ["generated", "read"] }).notNull(),
    generatedAtMs: integer("generated_at_ms").notNull(),
    readAtMs: integer("read_at_ms"),
  },
  (table) => [
    index("agent_care_events_user_generated_idx").on(
      table.userId,
      table.generatedAtMs,
    ),
    index("agent_care_events_message_idx").on(table.messageId),
    check(
      "agent_care_events_status_check",
      sql`${table.status} IN ('generated', 'read')`,
    ),
  ],
);

export type AgentRecord = typeof agents.$inferSelect;
export type UserAgentRecord = AgentRecord;
export type AgentConversationRecord = typeof agentConversations.$inferSelect;
export type AgentConversationMessageRecord =
  typeof agentConversationMessages.$inferSelect;
export type AgentMemoryRecord = typeof agentMemories.$inferSelect;
export type AgentMessageFeedbackRecord =
  typeof agentMessageFeedbacks.$inferSelect;
export type AgentCarePlanRecord = typeof agentCarePlans.$inferSelect;
export type AgentCareEventRecord = typeof agentCareEvents.$inferSelect;

export const userAgents = agents;
