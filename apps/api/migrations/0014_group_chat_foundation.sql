-- Migration 0014: agent group chat foundation (group chats + members + messages)

CREATE TABLE `agent_group_chats` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `title` text NOT NULL,
  `summary` text,
  `message_count` integer NOT NULL DEFAULT 0,
  `last_message_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `agent_group_chats_message_count_check` CHECK (`message_count` >= 0),
  CONSTRAINT `agent_group_chats_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE INDEX `agent_group_chats_user_updated_idx`
ON `agent_group_chats` (`user_id`, `updated_at_ms`);

CREATE TABLE `agent_group_chat_members` (
  `id` text PRIMARY KEY NOT NULL,
  `group_chat_id` text NOT NULL,
  `agent_id` text NOT NULL,
  `user_id` text NOT NULL,
  `display_order` integer NOT NULL,
  `status` text NOT NULL,
  `joined_at_ms` integer NOT NULL,
  `removed_at_ms` integer,
  FOREIGN KEY (`group_chat_id`) REFERENCES `agent_group_chats` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`agent_id`) REFERENCES `user_agents` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `agent_group_chat_members_status_check` CHECK (`status` IN ('active', 'removed'))
);

CREATE UNIQUE INDEX `agent_group_chat_members_group_agent_unique`
ON `agent_group_chat_members` (`group_chat_id`, `agent_id`);

CREATE INDEX `agent_group_chat_members_group_status_order_idx`
ON `agent_group_chat_members` (`group_chat_id`, `status`, `display_order`);

CREATE TABLE `agent_group_chat_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `group_chat_id` text NOT NULL,
  `sender_type` text NOT NULL,
  `agent_id` text,
  `content` text NOT NULL,
  `status` text NOT NULL,
  `turn_index` integer NOT NULL,
  `metadata_json` text,
  `created_at_ms` integer NOT NULL,
  FOREIGN KEY (`group_chat_id`) REFERENCES `agent_group_chats` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`agent_id`) REFERENCES `user_agents` (`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `agent_group_chat_messages_sender_type_check` CHECK (`sender_type` IN ('user', 'agent', 'system')),
  CONSTRAINT `agent_group_chat_messages_status_check` CHECK (`status` IN ('completed', 'failed'))
);

CREATE INDEX `agent_group_chat_messages_group_created_idx`
ON `agent_group_chat_messages` (`group_chat_id`, `created_at_ms`, `id`);
