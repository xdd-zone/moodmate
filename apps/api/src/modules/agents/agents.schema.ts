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

export const userAgents = sqliteTable(
  "user_agents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    headline: text("headline"),
    description: text("description"),
    storyBackground: text("story_background"),
    personaPrompt: text("persona_prompt"),
    tonePrompt: text("tone_prompt"),
    guardrailsPrompt: text("guardrails_prompt"),
    defaultPrompt: text("default_prompt"),
    imageKey: text("image_key"),
    status: text("status", { enum: ["active", "archived"] }).notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("user_agents_user_status_idx").on(
      table.userId,
      table.status,
      table.updatedAtMs,
    ),
    check(
      "user_agents_status_check",
      sql`${table.status} IN ('active', 'archived')`,
    ),
    check(
      "user_agents_timestamps_check",
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
      .references(() => userAgents.id, { onDelete: "cascade" }),
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
    index("agent_conversations_user_agent_idx").on(table.userId, table.agentId),
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

export const agentMemories = sqliteTable(
  "agent_memories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => userAgents.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    importance: integer("importance").notNull().default(3),
    status: text("status", {
      enum: ["active", "disabled", "deleted"],
    }).notNull(),
    sourceMessageId: text("source_message_id"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("agent_memories_user_agent_status_idx").on(
      table.userId,
      table.agentId,
      table.status,
      table.importance,
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

export type UserAgentRecord = typeof userAgents.$inferSelect;
export type AgentConversationRecord = typeof agentConversations.$inferSelect;
export type AgentMemoryRecord = typeof agentMemories.$inferSelect;
