-- Migration 0010: companion profile (name / persona / guardrails) per user

CREATE TABLE `companion_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `display_name` text,
  `persona` text,
  `guardrails` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `companion_profiles_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE UNIQUE INDEX `companion_profiles_user_unique`
ON `companion_profiles` (`user_id`);
