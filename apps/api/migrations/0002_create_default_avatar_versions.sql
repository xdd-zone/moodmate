CREATE TABLE `default_avatar_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `avatar_key` text NOT NULL,
  `file_name` text NOT NULL,
  `content_type` text NOT NULL,
  `size_bytes` integer NOT NULL,
  `created_by_user_id` text,
  `created_at_ms` integer NOT NULL,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `default_avatar_versions_avatar_key_unique` UNIQUE (`avatar_key`),
  CONSTRAINT `default_avatar_versions_content_type_check` CHECK (`content_type` IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT `default_avatar_versions_size_bytes_check` CHECK (`size_bytes` > 0 AND `size_bytes` <= 2097152),
  CONSTRAINT `default_avatar_versions_created_at_ms_check` CHECK (`created_at_ms` > 0)
);

CREATE INDEX `default_avatar_versions_created_at_ms_idx`
  ON `default_avatar_versions` (`created_at_ms`);
