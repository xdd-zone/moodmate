-- Migration 0013: multi-agent foundation (user_agents + per-agent conversations and memories)

CREATE TABLE `user_agents` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `headline` text,
  `description` text,
  `story_background` text,
  `persona_prompt` text,
  `tone_prompt` text,
  `guardrails_prompt` text,
  `default_prompt` text,
  `image_key` text,
  `status` text NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `user_agents_status_check` CHECK (`status` IN ('active', 'archived')),
  CONSTRAINT `user_agents_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE INDEX `user_agents_user_status_idx`
ON `user_agents` (`user_id`, `status`, `updated_at_ms`);

CREATE TABLE `agent_conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `agent_id` text NOT NULL,
  `title` text,
  `summary` text,
  `message_count` integer NOT NULL DEFAULT 0,
  `last_message_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`agent_id`) REFERENCES `user_agents` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `agent_conversations_message_count_check` CHECK (`message_count` >= 0),
  CONSTRAINT `agent_conversations_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE UNIQUE INDEX `agent_conversations_user_agent_unique`
ON `agent_conversations` (`user_id`, `agent_id`);

CREATE INDEX `agent_conversations_user_agent_idx`
ON `agent_conversations` (`user_id`, `agent_id`);

CREATE TABLE `agent_memories` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `agent_id` text NOT NULL,
  `type` text NOT NULL,
  `content` text NOT NULL,
  `importance` integer NOT NULL DEFAULT 3,
  `status` text NOT NULL,
  `source_message_id` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`agent_id`) REFERENCES `user_agents` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `agent_memories_importance_check` CHECK (`importance` BETWEEN 1 AND 5),
  CONSTRAINT `agent_memories_status_check` CHECK (`status` IN ('active', 'disabled', 'deleted')),
  CONSTRAINT `agent_memories_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE INDEX `agent_memories_user_agent_status_idx`
ON `agent_memories` (`user_id`, `agent_id`, `status`, `importance`);
