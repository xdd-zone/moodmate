CREATE TABLE `oauth_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_user_id` text NOT NULL,
  `provider_login` text,
  `email_id` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`email_id`) REFERENCES `user_emails` (`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `oauth_accounts_provider_user_unique` UNIQUE (`provider`, `provider_user_id`),
  CONSTRAINT `oauth_accounts_provider_check` CHECK (`provider` IN ('github', 'google')),
  CONSTRAINT `oauth_accounts_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE INDEX `oauth_accounts_user_idx` ON `oauth_accounts` (`user_id`);

CREATE TABLE `oauth_login_tickets` (
  `id` text PRIMARY KEY NOT NULL,
  `ticket_hash` text NOT NULL,
  `user_id` text NOT NULL,
  `application_id` text NOT NULL,
  `provider` text NOT NULL,
  `created_at_ms` integer NOT NULL,
  `expires_at_ms` integer NOT NULL,
  `used_at_ms` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `oauth_login_tickets_hash_unique` UNIQUE (`ticket_hash`),
  CONSTRAINT `oauth_login_tickets_provider_check` CHECK (`provider` IN ('github', 'google')),
  CONSTRAINT `oauth_login_tickets_expiry_check` CHECK (`expires_at_ms` > `created_at_ms`),
  CONSTRAINT `oauth_login_tickets_used_at_check` CHECK (`used_at_ms` IS NULL OR `used_at_ms` >= `created_at_ms`)
);

CREATE INDEX `oauth_login_tickets_user_idx` ON `oauth_login_tickets` (`user_id`);

INSERT INTO `application_auth_methods` (
  `id`, `application_id`, `provider`, `enabled`, `created_at_ms`, `updated_at_ms`
)
SELECT
  '019f8914-43ab-7ed1-814f-0de82e3f1af6',
  `id`,
  'github',
  1,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `applications`
WHERE `code` = 'web'
ON CONFLICT (`application_id`, `provider`) DO UPDATE SET
  `enabled` = 1,
  `updated_at_ms` = excluded.`updated_at_ms`;
