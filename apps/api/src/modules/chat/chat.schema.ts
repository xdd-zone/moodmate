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

export type CompanionConversationRecord =
  typeof companionConversations.$inferSelect;
export type CompanionConversationMessageRecord =
  typeof companionConversationMessages.$inferSelect;
export type CompanionMemoryRecord = typeof companionMemories.$inferSelect;
