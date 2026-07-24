-- Migration 0012: companion proactive care (care plans + care events per user)

CREATE TABLE `companion_care_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
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
  CONSTRAINT `companion_care_plans_frequency_check` CHECK (`frequency` IN ('daily', 'weekly', 'custom')),
  CONSTRAINT `companion_care_plans_tone_check` CHECK (`tone` IN ('light', 'gentle', 'intimate')),
  CONSTRAINT `companion_care_plans_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE UNIQUE INDEX `companion_care_plans_user_unique`
ON `companion_care_plans` (`user_id`);

CREATE INDEX `companion_care_plans_enabled_next_run_idx`
ON `companion_care_plans` (`enabled`, `next_run_at_ms`);

CREATE TABLE `companion_care_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `care_plan_id` text,
  `conversation_id` text NOT NULL,
  `message_id` text NOT NULL,
  `scene` text NOT NULL,
  `status` text NOT NULL,
  `message` text NOT NULL,
  `metadata_json` text,
  `generated_at_ms` integer NOT NULL,
  `read_at_ms` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`care_plan_id`) REFERENCES `companion_care_plans` (`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`conversation_id`) REFERENCES `companion_conversations` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`message_id`) REFERENCES `companion_conversation_messages` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `companion_care_events_status_check` CHECK (`status` IN ('generated', 'read'))
);

CREATE INDEX `companion_care_events_user_generated_idx`
ON `companion_care_events` (`user_id`, `generated_at_ms`);

CREATE INDEX `companion_care_events_message_idx`
ON `companion_care_events` (`message_id`);

CREATE INDEX `companion_care_events_user_status_read_idx`
ON `companion_care_events` (`user_id`, `status`, `read_at_ms`);
