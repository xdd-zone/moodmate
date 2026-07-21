CREATE TABLE `auth_sessions_next` (
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
  CONSTRAINT `auth_sessions_type_check` CHECK (`session_type` IN ('admin', 'web')),
  CONSTRAINT `auth_sessions_expiry_check` CHECK (`expires_at_ms` > `created_at_ms`),
  CONSTRAINT `auth_sessions_last_seen_check` CHECK (`last_seen_at_ms` >= `created_at_ms`),
  CONSTRAINT `auth_sessions_revoke_reason_check` CHECK (`revoked_at_ms` IS NULL OR `revoke_reason` IS NOT NULL)
);

INSERT INTO `auth_sessions_next` (
  `id`, `user_id`, `application_id`, `session_type`, `user_agent`, `ip`,
  `last_seen_at_ms`, `created_at_ms`, `expires_at_ms`, `revoked_at_ms`, `revoke_reason`
)
SELECT
  `id`, `user_id`, `application_id`, `session_type`, `user_agent`, `ip`,
  `last_seen_at_ms`, `created_at_ms`, `expires_at_ms`, `revoked_at_ms`, `revoke_reason`
FROM `auth_sessions`;

CREATE TABLE `refresh_tokens_backup` AS
SELECT
  `id`, `session_id`, `jti_hash`, `parent_token_id`, `issued_at_ms`,
  `expires_at_ms`, `used_at_ms`, `revoked_at_ms`, `replaced_by_token_id`
FROM `refresh_tokens`;

DROP TRIGGER `refresh_tokens_validate_session_insert`;
DROP TRIGGER `refresh_tokens_validate_rotation_insert`;
DROP TRIGGER `refresh_tokens_validate_replacement_update`;
DROP TABLE `refresh_tokens`;
DROP TABLE `auth_sessions`;

ALTER TABLE `auth_sessions_next` RENAME TO `auth_sessions`;

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

INSERT INTO `refresh_tokens` (
  `id`, `session_id`, `jti_hash`, `parent_token_id`, `issued_at_ms`,
  `expires_at_ms`, `used_at_ms`, `revoked_at_ms`, `replaced_by_token_id`
)
SELECT
  `id`, `session_id`, `jti_hash`, `parent_token_id`, `issued_at_ms`,
  `expires_at_ms`, `used_at_ms`, `revoked_at_ms`, `replaced_by_token_id`
FROM `refresh_tokens_backup`;

DROP TABLE `refresh_tokens_backup`;

CREATE INDEX `auth_sessions_user_app_status_idx`
  ON `auth_sessions` (`user_id`, `application_id`, `revoked_at_ms`, `expires_at_ms`);

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
