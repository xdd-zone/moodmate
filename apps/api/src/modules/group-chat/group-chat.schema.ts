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
import { userAgents } from "@/modules/agents/agents.schema";

export const agentGroupChats = sqliteTable(
  "agent_group_chats",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary"),
    messageCount: integer("message_count").notNull().default(0),
    lastMessageAtMs: integer("last_message_at_ms"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("agent_group_chats_user_updated_idx").on(
      table.userId,
      table.updatedAtMs,
    ),
    check(
      "agent_group_chats_message_count_check",
      sql`${table.messageCount} >= 0`,
    ),
    check(
      "agent_group_chats_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const agentGroupChatMembers = sqliteTable(
  "agent_group_chat_members",
  {
    id: text("id").primaryKey(),
    groupChatId: text("group_chat_id")
      .notNull()
      .references(() => agentGroupChats.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => userAgents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").notNull(),
    status: text("status", { enum: ["active", "removed"] }).notNull(),
    joinedAtMs: integer("joined_at_ms").notNull(),
    removedAtMs: integer("removed_at_ms"),
  },
  (table) => [
    unique("agent_group_chat_members_group_agent_unique").on(
      table.groupChatId,
      table.agentId,
    ),
    index("agent_group_chat_members_group_status_order_idx").on(
      table.groupChatId,
      table.status,
      table.displayOrder,
    ),
    check(
      "agent_group_chat_members_status_check",
      sql`${table.status} IN ('active', 'removed')`,
    ),
  ],
);

export const agentGroupChatMessages = sqliteTable(
  "agent_group_chat_messages",
  {
    id: text("id").primaryKey(),
    groupChatId: text("group_chat_id")
      .notNull()
      .references(() => agentGroupChats.id, { onDelete: "cascade" }),
    senderType: text("sender_type", {
      enum: ["user", "agent", "system"],
    }).notNull(),
    agentId: text("agent_id").references(() => userAgents.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    status: text("status", { enum: ["completed", "failed"] }).notNull(),
    turnIndex: integer("turn_index").notNull(),
    metadataJson: text("metadata_json"),
    createdAtMs: integer("created_at_ms").notNull(),
  },
  (table) => [
    index("agent_group_chat_messages_group_created_idx").on(
      table.groupChatId,
      table.createdAtMs,
      table.id,
    ),
    check(
      "agent_group_chat_messages_sender_type_check",
      sql`${table.senderType} IN ('user', 'agent', 'system')`,
    ),
    check(
      "agent_group_chat_messages_status_check",
      sql`${table.status} IN ('completed', 'failed')`,
    ),
  ],
);

export type AgentGroupChatRecord = typeof agentGroupChats.$inferSelect;
export type AgentGroupChatMemberRecord =
  typeof agentGroupChatMembers.$inferSelect;
export type AgentGroupChatMessageRecord =
  typeof agentGroupChatMessages.$inferSelect;
