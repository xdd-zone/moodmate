-- Migration 0011: companion message feedbacks (thumbs up / down per user + message)

CREATE TABLE `companion_message_feedbacks` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `conversation_id` text NOT NULL,
  `message_id` text NOT NULL,
  `rating` text NOT NULL,
  `reason` text,
  `note` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`conversation_id`) REFERENCES `companion_conversations` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`message_id`) REFERENCES `companion_conversation_messages` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `companion_message_feedbacks_rating_check` CHECK (`rating` IN ('positive', 'negative')),
  CONSTRAINT `companion_message_feedbacks_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE UNIQUE INDEX `companion_message_feedbacks_user_message_unique`
ON `companion_message_feedbacks` (`user_id`, `message_id`);
