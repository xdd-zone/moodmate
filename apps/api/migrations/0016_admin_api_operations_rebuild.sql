-- Migration 0016: replace companion/user-agent storage with unified agent and operations tables.
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS `agent_group_chat_messages`;
DROP TABLE IF EXISTS `agent_group_chat_members`;
DROP TABLE IF EXISTS `agent_group_chats`;
DROP TABLE IF EXISTS `agent_memories`;
DROP TABLE IF EXISTS `agent_conversations`;
DROP TABLE IF EXISTS `user_agents`;
DROP TABLE IF EXISTS `companion_care_events`;
DROP TABLE IF EXISTS `companion_care_plans`;
DROP TABLE IF EXISTS `companion_message_feedbacks`;
DROP TABLE IF EXISTS `companion_memories`;
DROP TABLE IF EXISTS `companion_conversation_messages`;
DROP TABLE IF EXISTS `companion_conversations`;
DROP TABLE IF EXISTS `companion_profiles`;

CREATE TABLE `agents` (
  `id` text PRIMARY KEY NOT NULL,
  `source` text NOT NULL,
  `owner_user_id` text,
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
  FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `agents_source_check` CHECK (`source` IN ('system', 'user')),
  CONSTRAINT `agents_owner_source_check` CHECK ((`source` = 'system' AND `owner_user_id` IS NULL) OR (`source` = 'user' AND `owner_user_id` IS NOT NULL)),
  CONSTRAINT `agents_status_check` CHECK ((`source` = 'system' AND `status` IN ('active', 'disabled')) OR (`source` = 'user' AND `status` IN ('active', 'archived'))),
  CONSTRAINT `agents_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);
CREATE INDEX `agents_source_status_updated_idx` ON `agents` (`source`, `status`, `updated_at_ms`);
CREATE INDEX `agents_owner_status_updated_idx` ON `agents` (`owner_user_id`, `status`, `updated_at_ms`);

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
  FOREIGN KEY (`agent_id`) REFERENCES `agents` (`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `agent_conversations_message_count_check` CHECK (`message_count` >= 0),
  CONSTRAINT `agent_conversations_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);
CREATE UNIQUE INDEX `agent_conversations_user_agent_unique` ON `agent_conversations` (`user_id`, `agent_id`);
CREATE INDEX `agent_conversations_user_updated_idx` ON `agent_conversations` (`user_id`, `updated_at_ms`);

CREATE TABLE `agent_conversation_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL,
  `turn_id` text NOT NULL,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `status` text NOT NULL,
  `metadata_json` text,
  `created_at_ms` integer NOT NULL,
  FOREIGN KEY (`conversation_id`) REFERENCES `agent_conversations` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `agent_conversation_messages_role_check` CHECK (`role` IN ('user', 'assistant')),
  CONSTRAINT `agent_conversation_messages_status_check` CHECK (`status` IN ('completed', 'failed'))
);
CREATE INDEX `agent_conversation_messages_conversation_created_idx` ON `agent_conversation_messages` (`conversation_id`, `created_at_ms`, `id`);
CREATE INDEX `agent_conversation_messages_turn_idx` ON `agent_conversation_messages` (`turn_id`);

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
  FOREIGN KEY (`agent_id`) REFERENCES `agents` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`source_message_id`) REFERENCES `agent_conversation_messages` (`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `agent_memories_importance_check` CHECK (`importance` BETWEEN 1 AND 5),
  CONSTRAINT `agent_memories_status_check` CHECK (`status` IN ('active', 'disabled', 'deleted')),
  CONSTRAINT `agent_memories_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);
CREATE INDEX `agent_memories_user_agent_status_idx` ON `agent_memories` (`user_id`, `agent_id`, `status`, `importance`, `updated_at_ms`);

CREATE TABLE `agent_message_feedbacks` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `conversation_id` text NOT NULL,
  `message_id` text NOT NULL,
  `turn_id` text NOT NULL,
  `rating` text NOT NULL,
  `reason` text,
  `note` text,
  `status` text NOT NULL DEFAULT 'pending',
  `processed_by_admin_user_id` text,
  `processed_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`conversation_id`) REFERENCES `agent_conversations` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`message_id`) REFERENCES `agent_conversation_messages` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`processed_by_admin_user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `agent_message_feedbacks_rating_check` CHECK (`rating` IN ('positive', 'negative')),
  CONSTRAINT `agent_message_feedbacks_status_check` CHECK (`status` IN ('pending', 'processed')),
  CONSTRAINT `agent_message_feedbacks_processed_check` CHECK ((`status` = 'pending' AND `processed_at_ms` IS NULL) OR (`status` = 'processed' AND `processed_at_ms` IS NOT NULL)),
  CONSTRAINT `agent_message_feedbacks_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);
CREATE UNIQUE INDEX `agent_message_feedbacks_user_message_unique` ON `agent_message_feedbacks` (`user_id`, `message_id`);
CREATE INDEX `agent_message_feedbacks_status_updated_idx` ON `agent_message_feedbacks` (`status`, `updated_at_ms`);

CREATE TABLE `agent_care_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `agent_id` text,
  `enabled` integer NOT NULL,
  `frequency` text NOT NULL,
  `preferred_time` text,
  `scenes_json` text NOT NULL,
  `tone` text NOT NULL,
  `custom_prompt` text,
  `next_run_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`agent_id`) REFERENCES `agents` (`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `agent_care_plans_enabled_agent_check` CHECK (`enabled` = 0 OR `agent_id` IS NOT NULL),
  CONSTRAINT `agent_care_plans_enabled_check` CHECK (`enabled` IN (0, 1)),
  CONSTRAINT `agent_care_plans_frequency_check` CHECK (`frequency` IN ('daily', 'weekly', 'custom')),
  CONSTRAINT `agent_care_plans_tone_check` CHECK (`tone` IN ('light', 'gentle', 'intimate')),
  CONSTRAINT `agent_care_plans_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);
CREATE UNIQUE INDEX `agent_care_plans_user_unique` ON `agent_care_plans` (`user_id`);
CREATE INDEX `agent_care_plans_enabled_next_run_idx` ON `agent_care_plans` (`enabled`, `next_run_at_ms`);

CREATE TABLE `agent_care_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `agent_id` text NOT NULL,
  `care_plan_id` text,
  `conversation_id` text NOT NULL,
  `message_id` text NOT NULL,
  `scene` text NOT NULL,
  `status` text NOT NULL,
  `generated_at_ms` integer NOT NULL,
  `read_at_ms` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`agent_id`) REFERENCES `agents` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`care_plan_id`) REFERENCES `agent_care_plans` (`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`conversation_id`) REFERENCES `agent_conversations` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`message_id`) REFERENCES `agent_conversation_messages` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `agent_care_events_status_check` CHECK (`status` IN ('generated', 'read'))
);
CREATE INDEX `agent_care_events_user_generated_idx` ON `agent_care_events` (`user_id`, `generated_at_ms`);
CREATE INDEX `agent_care_events_message_idx` ON `agent_care_events` (`message_id`);

CREATE TABLE `ai_call_records` (
  `id` text PRIMARY KEY NOT NULL,
  `operation_id` text NOT NULL,
  `attempt_index` integer NOT NULL,
  `request_id` text NOT NULL,
  `user_id` text,
  `initiator_type` text NOT NULL,
  `initiator_id` text,
  `subject_type` text NOT NULL,
  `agent_id` text,
  `agent_name_snapshot` text,
  `agent_source_snapshot` text,
  `scenario` text NOT NULL,
  `conversation_type` text NOT NULL,
  `conversation_id` text,
  `llm_config_id` text,
  `api` text NOT NULL,
  `provider_name` text NOT NULL,
  `model` text NOT NULL,
  `structured_output_method` text,
  `status` text NOT NULL,
  `usage_status` text NOT NULL,
  `prompt_tokens` integer,
  `completion_tokens` integer,
  `total_tokens` integer,
  `finish_reason` text,
  `error_code` text,
  `error_message` text,
  `duration_ms` integer,
  `started_at_ms` integer NOT NULL,
  `finished_at_ms` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`agent_id`) REFERENCES `agents` (`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`llm_config_id`) REFERENCES `llm_provider_configs` (`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `ai_call_records_attempt_check` CHECK (`attempt_index` >= 0),
  CONSTRAINT `ai_call_records_status_check` CHECK (`status` IN ('started', 'completed', 'failed', 'aborted')),
  CONSTRAINT `ai_call_records_usage_status_check` CHECK (`usage_status` IN ('pending', 'reported', 'unavailable')),
  CONSTRAINT `ai_call_records_timestamps_check` CHECK (`finished_at_ms` IS NULL OR `finished_at_ms` >= `started_at_ms`)
);
CREATE UNIQUE INDEX `ai_call_records_operation_attempt_unique` ON `ai_call_records` (`operation_id`, `attempt_index`);
CREATE INDEX `ai_call_records_user_started_idx` ON `ai_call_records` (`user_id`, `started_at_ms`);
CREATE INDEX `ai_call_records_user_agent_started_idx` ON `ai_call_records` (`user_id`, `agent_id`, `started_at_ms`);
CREATE INDEX `ai_call_records_scenario_started_idx` ON `ai_call_records` (`scenario`, `started_at_ms`);
CREATE INDEX `ai_call_records_status_started_idx` ON `ai_call_records` (`status`, `started_at_ms`);
CREATE INDEX `ai_call_records_llm_config_started_idx` ON `ai_call_records` (`llm_config_id`, `started_at_ms`);

CREATE TABLE `admin_sensitive_access_audits` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_user_id` text NOT NULL,
  `action` text NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text NOT NULL,
  `request_id` text NOT NULL,
  `created_at_ms` integer NOT NULL,
  FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `admin_sensitive_access_audits_resource_check` CHECK (`resource_type` = 'message_feedback')
);
CREATE INDEX `admin_sensitive_access_audits_resource_idx` ON `admin_sensitive_access_audits` (`resource_type`, `resource_id`, `created_at_ms`);

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
CREATE INDEX `agent_group_chats_user_updated_idx` ON `agent_group_chats` (`user_id`, `updated_at_ms`);

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
  FOREIGN KEY (`agent_id`) REFERENCES `agents` (`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `agent_group_chat_members_status_check` CHECK (`status` IN ('active', 'removed'))
);
CREATE UNIQUE INDEX `agent_group_chat_members_group_agent_unique` ON `agent_group_chat_members` (`group_chat_id`, `agent_id`);
CREATE INDEX `agent_group_chat_members_group_status_order_idx` ON `agent_group_chat_members` (`group_chat_id`, `status`, `display_order`);

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
  FOREIGN KEY (`agent_id`) REFERENCES `agents` (`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `agent_group_chat_messages_sender_type_check` CHECK (`sender_type` IN ('user', 'agent', 'system')),
  CONSTRAINT `agent_group_chat_messages_status_check` CHECK (`status` IN ('completed', 'failed'))
);
CREATE INDEX `agent_group_chat_messages_group_created_idx` ON `agent_group_chat_messages` (`group_chat_id`, `created_at_ms`, `id`);

PRAGMA foreign_keys = ON;
