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

export const companionConversations = sqliteTable(
  "companion_conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    summary: text("summary"),
    messageCount: integer("message_count").notNull().default(0),
    lastMessageAtMs: integer("last_message_at_ms"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("companion_conversations_user_unique").on(table.userId),
    index("companion_conversations_user_updated_idx").on(
      table.userId,
      table.updatedAtMs,
    ),
    check(
      "companion_conversations_message_count_check",
      sql`${table.messageCount} >= 0`,
    ),
    check(
      "companion_conversations_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const companionConversationMessages = sqliteTable(
  "companion_conversation_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => companionConversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    status: text("status", { enum: ["completed", "failed"] }).notNull(),
    metadataJson: text("metadata_json"),
    createdAtMs: integer("created_at_ms").notNull(),
  },
  (table) => [
    index("companion_conversation_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAtMs,
      table.id,
    ),
    index("companion_conversation_messages_user_created_idx").on(
      table.userId,
      table.createdAtMs,
    ),
    check(
      "companion_conversation_messages_role_check",
      sql`${table.role} IN ('user', 'assistant')`,
    ),
    check(
      "companion_conversation_messages_status_check",
      sql`${table.status} IN ('completed', 'failed')`,
    ),
  ],
);

export const companionMemories = sqliteTable(
  "companion_memories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    importance: integer("importance").notNull().default(3),
    status: text("status", {
      enum: ["active", "disabled", "deleted"],
    }).notNull(),
    sourceMessageId: text("source_message_id").references(
      () => companionConversationMessages.id,
      { onDelete: "set null" },
    ),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("companion_memories_user_status_importance_idx").on(
      table.userId,
      table.status,
      table.importance,
      table.updatedAtMs,
    ),
    index("companion_memories_source_message_idx").on(table.sourceMessageId),
    check(
      "companion_memories_importance_check",
      sql`${table.importance} BETWEEN 1 AND 5`,
    ),
    check(
      "companion_memories_status_check",
      sql`${table.status} IN ('active', 'disabled', 'deleted')`,
    ),
    check(
      "companion_memories_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const companionProfiles = sqliteTable(
  "companion_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    persona: text("persona"),
    guardrails: text("guardrails"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("companion_profiles_user_unique").on(table.userId),
    check(
      "companion_profiles_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const companionMessageFeedbacks = sqliteTable(
  "companion_message_feedbacks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => companionConversations.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => companionConversationMessages.id, {
        onDelete: "cascade",
      }),
    rating: text("rating", { enum: ["positive", "negative"] }).notNull(),
    reason: text("reason"),
    note: text("note"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("companion_message_feedbacks_user_message_unique").on(
      table.userId,
      table.messageId,
    ),
    check(
      "companion_message_feedbacks_rating_check",
      sql`${table.rating} IN ('positive', 'negative')`,
    ),
    check(
      "companion_message_feedbacks_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const companionCarePlans = sqliteTable(
  "companion_care_plans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    enabled: integer("enabled").notNull(),
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
    unique("companion_care_plans_user_unique").on(table.userId),
    index("companion_care_plans_enabled_next_run_idx").on(
      table.enabled,
      table.nextRunAtMs,
    ),
    check(
      "companion_care_plans_frequency_check",
      sql`${table.frequency} IN ('daily', 'weekly', 'custom')`,
    ),
    check(
      "companion_care_plans_tone_check",
      sql`${table.tone} IN ('light', 'gentle', 'intimate')`,
    ),
    check(
      "companion_care_plans_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const companionCareEvents = sqliteTable(
  "companion_care_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    carePlanId: text("care_plan_id").references(() => companionCarePlans.id, {
      onDelete: "set null",
    }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => companionConversations.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => companionConversationMessages.id, {
        onDelete: "cascade",
      }),
    scene: text("scene").notNull(),
    status: text("status", { enum: ["generated", "read"] }).notNull(),
    message: text("message").notNull(),
    metadataJson: text("metadata_json"),
    generatedAtMs: integer("generated_at_ms").notNull(),
    readAtMs: integer("read_at_ms"),
  },
  (table) => [
    index("companion_care_events_user_generated_idx").on(
      table.userId,
      table.generatedAtMs,
    ),
    index("companion_care_events_message_idx").on(table.messageId),
    index("companion_care_events_user_status_read_idx").on(
      table.userId,
      table.status,
      table.readAtMs,
    ),
    check(
      "companion_care_events_status_check",
      sql`${table.status} IN ('generated', 'read')`,
    ),
  ],
);

export type CompanionConversationRecord =
  typeof companionConversations.$inferSelect;
export type CompanionConversationMessageRecord =
  typeof companionConversationMessages.$inferSelect;
export type CompanionMemoryRecord = typeof companionMemories.$inferSelect;
export type CompanionProfileRecord = typeof companionProfiles.$inferSelect;
export type CompanionMessageFeedbackRecord =
  typeof companionMessageFeedbacks.$inferSelect;
export type CompanionCarePlanRecord = typeof companionCarePlans.$inferSelect;
export type CompanionCareEventRecord = typeof companionCareEvents.$inferSelect;
