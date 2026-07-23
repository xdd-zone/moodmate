CREATE TABLE `companion_conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `title` text,
  `summary` text,
  `message_count` integer NOT NULL DEFAULT 0,
  `last_message_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `companion_conversations_user_unique` UNIQUE (`user_id`),
  CONSTRAINT `companion_conversations_message_count_check` CHECK (`message_count` >= 0),
  CONSTRAINT `companion_conversations_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE INDEX `companion_conversations_user_updated_idx`
ON `companion_conversations` (`user_id`, `updated_at_ms`);

CREATE TABLE `companion_conversation_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `status` text NOT NULL,
  `metadata_json` text,
  `created_at_ms` integer NOT NULL,
  FOREIGN KEY (`conversation_id`) REFERENCES `companion_conversations` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `companion_conversation_messages_role_check` CHECK (`role` IN ('user', 'assistant')),
  CONSTRAINT `companion_conversation_messages_status_check` CHECK (`status` IN ('completed', 'failed'))
);

CREATE INDEX `companion_conversation_messages_conversation_created_idx`
ON `companion_conversation_messages` (`conversation_id`, `created_at_ms`, `id`);

CREATE INDEX `companion_conversation_messages_user_created_idx`
ON `companion_conversation_messages` (`user_id`, `created_at_ms`);

CREATE TABLE `companion_memories` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `type` text NOT NULL,
  `content` text NOT NULL,
  `importance` integer NOT NULL DEFAULT 3,
  `status` text NOT NULL,
  `source_message_id` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`source_message_id`) REFERENCES `companion_conversation_messages` (`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `companion_memories_importance_check` CHECK (`importance` BETWEEN 1 AND 5),
  CONSTRAINT `companion_memories_status_check` CHECK (`status` IN ('active', 'disabled', 'deleted')),
  CONSTRAINT `companion_memories_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE INDEX `companion_memories_user_status_importance_idx`
ON `companion_memories` (`user_id`, `status`, `importance`, `updated_at_ms`);

CREATE INDEX `companion_memories_source_message_idx`
ON `companion_memories` (`source_message_id`);
