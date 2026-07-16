PRAGMA foreign_keys = ON;

CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `status` text NOT NULL,
  `display_name` text NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  `last_login_at_ms` integer,
  CONSTRAINT `users_status_check` CHECK (`status` IN ('active', 'suspended', 'deleted')),
  CONSTRAINT `users_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE TABLE `user_emails` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `email` text NOT NULL,
  `normalized_email` text NOT NULL,
  `is_primary` integer NOT NULL DEFAULT 0,
  `is_verified` integer NOT NULL DEFAULT 0,
  `verified_at_ms` integer,
  `source` text NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `user_emails_primary_check` CHECK (`is_primary` IN (0, 1)),
  CONSTRAINT `user_emails_verified_check` CHECK (`is_verified` IN (0, 1)),
  CONSTRAINT `user_emails_verified_at_check` CHECK (`is_verified` = 0 OR `verified_at_ms` IS NOT NULL),
  CONSTRAINT `user_emails_source_check` CHECK (`source` IN ('password', 'oauth', 'system')),
  CONSTRAINT `user_emails_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`),
  CONSTRAINT `user_emails_user_normalized_unique` UNIQUE (`user_id`, `normalized_email`),
  CONSTRAINT `user_emails_normalized_unique` UNIQUE (`normalized_email`)
);

CREATE UNIQUE INDEX `user_emails_primary_user_unique`
  ON `user_emails` (`user_id`)
  WHERE `is_primary` = 1;

CREATE TABLE `password_credentials` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `email_id` text NOT NULL,
  `password_hash` text NOT NULL,
  `password_algo` text NOT NULL,
  `password_updated_at_ms` integer NOT NULL,
  `failed_attempts` integer NOT NULL DEFAULT 0,
  `locked_until_ms` integer,
  `must_reset_password` integer NOT NULL DEFAULT 0,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`email_id`) REFERENCES `user_emails` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `password_credentials_user_unique` UNIQUE (`user_id`),
  CONSTRAINT `password_credentials_email_unique` UNIQUE (`email_id`),
  CONSTRAINT `password_credentials_algo_check` CHECK (`password_algo` = 'pbkdf2-sha256'),
  CONSTRAINT `password_credentials_failed_attempts_check` CHECK (`failed_attempts` >= 0),
  CONSTRAINT `password_credentials_reset_check` CHECK (`must_reset_password` IN (0, 1)),
  CONSTRAINT `password_credentials_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE TABLE `applications` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `status` text NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  CONSTRAINT `applications_code_unique` UNIQUE (`code`),
  CONSTRAINT `applications_status_check` CHECK (`status` IN ('active', 'disabled')),
  CONSTRAINT `applications_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE TABLE `application_auth_methods` (
  `id` text PRIMARY KEY NOT NULL,
  `application_id` text NOT NULL,
  `provider` text NOT NULL,
  `enabled` integer NOT NULL DEFAULT 1,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `application_auth_methods_unique` UNIQUE (`application_id`, `provider`),
  CONSTRAINT `application_auth_methods_provider_check` CHECK (`provider` IN ('password', 'github', 'google')),
  CONSTRAINT `application_auth_methods_enabled_check` CHECK (`enabled` IN (0, 1)),
  CONSTRAINT `application_auth_methods_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE TABLE `roles` (
  `id` text PRIMARY KEY NOT NULL,
  `application_id` text NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `roles_application_code_unique` UNIQUE (`application_id`, `code`),
  CONSTRAINT `roles_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE TABLE `user_role_bindings` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `role_id` text NOT NULL,
  `status` text NOT NULL,
  `granted_at_ms` integer NOT NULL,
  `revoked_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `user_role_bindings_unique` UNIQUE (`user_id`, `role_id`),
  CONSTRAINT `user_role_bindings_status_check` CHECK (`status` IN ('active', 'revoked')),
  CONSTRAINT `user_role_bindings_revoked_at_check` CHECK (`status` = 'active' OR `revoked_at_ms` IS NOT NULL),
  CONSTRAINT `user_role_bindings_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE INDEX `user_role_bindings_user_status_idx`
  ON `user_role_bindings` (`user_id`, `status`);
CREATE INDEX `user_role_bindings_role_status_idx`
  ON `user_role_bindings` (`role_id`, `status`);

CREATE TABLE `auth_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `application_id` text NOT NULL,
  `session_type` text NOT NULL,
  `user_agent` text,
  `ip` text,
  `last_seen_at_ms` integer NOT NULL,
  `created_at_ms` integer NOT NULL,
  `expires_at_ms` integer NOT NULL,
  `revoked_at_ms` integer,
  `revoke_reason` text,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `auth_sessions_type_check` CHECK (`session_type` = 'admin'),
  CONSTRAINT `auth_sessions_expiry_check` CHECK (`expires_at_ms` > `created_at_ms`),
  CONSTRAINT `auth_sessions_last_seen_check` CHECK (`last_seen_at_ms` >= `created_at_ms`),
  CONSTRAINT `auth_sessions_revoke_reason_check` CHECK (`revoked_at_ms` IS NULL OR `revoke_reason` IS NOT NULL)
);

CREATE INDEX `auth_sessions_user_app_status_idx`
  ON `auth_sessions` (`user_id`, `application_id`, `revoked_at_ms`, `expires_at_ms`);

CREATE TABLE `refresh_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL,
  `jti_hash` text NOT NULL,
  `parent_token_id` text,
  `issued_at_ms` integer NOT NULL,
  `expires_at_ms` integer NOT NULL,
  `used_at_ms` integer,
  `revoked_at_ms` integer,
  `replaced_by_token_id` text,
  FOREIGN KEY (`session_id`) REFERENCES `auth_sessions` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`parent_token_id`) REFERENCES `refresh_tokens` (`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`replaced_by_token_id`) REFERENCES `refresh_tokens` (`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `refresh_tokens_jti_hash_unique` UNIQUE (`jti_hash`),
  CONSTRAINT `refresh_tokens_expiry_check` CHECK (`expires_at_ms` > `issued_at_ms`),
  CONSTRAINT `refresh_tokens_not_self_parent_check` CHECK (`parent_token_id` IS NULL OR `parent_token_id` != `id`),
  CONSTRAINT `refresh_tokens_not_self_replacement_check` CHECK (`replaced_by_token_id` IS NULL OR `replaced_by_token_id` != `id`)
);

CREATE UNIQUE INDEX `refresh_tokens_parent_unique`
  ON `refresh_tokens` (`parent_token_id`)
  WHERE `parent_token_id` IS NOT NULL;
CREATE INDEX `refresh_tokens_session_status_idx`
  ON `refresh_tokens` (`session_id`, `revoked_at_ms`, `expires_at_ms`);

CREATE TRIGGER `refresh_tokens_validate_session_insert`
BEFORE INSERT ON `refresh_tokens`
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `auth_sessions` AS session
      WHERE session.`id` = NEW.`session_id`
        AND session.`revoked_at_ms` IS NULL
        AND NEW.`issued_at_ms` >= session.`created_at_ms`
        AND NEW.`expires_at_ms` <= session.`expires_at_ms`
    )
    THEN RAISE(ABORT, 'refresh token exceeds its session lifetime')
  END;
END;

CREATE TRIGGER `refresh_tokens_validate_rotation_insert`
BEFORE INSERT ON `refresh_tokens`
WHEN NEW.`parent_token_id` IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `refresh_tokens` AS parent
      INNER JOIN `auth_sessions` AS session ON session.`id` = parent.`session_id`
      WHERE parent.`id` = NEW.`parent_token_id`
        AND parent.`session_id` = NEW.`session_id`
        AND parent.`used_at_ms` IS NULL
        AND parent.`revoked_at_ms` IS NULL
        AND parent.`replaced_by_token_id` IS NULL
        AND parent.`expires_at_ms` > NEW.`issued_at_ms`
        AND session.`revoked_at_ms` IS NULL
        AND session.`expires_at_ms` > NEW.`issued_at_ms`
        AND NEW.`expires_at_ms` <= session.`expires_at_ms`
    )
    THEN RAISE(ABORT, 'refresh rotation source is not active')
  END;
END;

CREATE TRIGGER `refresh_tokens_validate_replacement_update`
BEFORE UPDATE OF `used_at_ms`, `replaced_by_token_id` ON `refresh_tokens`
WHEN NEW.`replaced_by_token_id` IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NEW.`used_at_ms` IS NULL OR NOT EXISTS (
      SELECT 1
      FROM `refresh_tokens` AS replacement
      WHERE replacement.`id` = NEW.`replaced_by_token_id`
        AND replacement.`parent_token_id` = OLD.`id`
        AND replacement.`session_id` = OLD.`session_id`
        AND replacement.`issued_at_ms` = NEW.`used_at_ms`
    )
    THEN RAISE(ABORT, 'refresh replacement link is invalid')
  END;
END;
