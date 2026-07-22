CREATE TABLE `user_avatar_assets` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `avatar_key` text NOT NULL,
  `file_name` text NOT NULL,
  `content_type` text NOT NULL,
  `size_bytes` integer NOT NULL,
  `created_at_ms` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `user_avatar_assets_user_id_unique` UNIQUE (`user_id`),
  CONSTRAINT `user_avatar_assets_avatar_key_unique` UNIQUE (`avatar_key`),
  CONSTRAINT `user_avatar_assets_content_type_check` CHECK (`content_type` IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT `user_avatar_assets_size_bytes_check` CHECK (`size_bytes` > 0 AND `size_bytes` <= 2097152),
  CONSTRAINT `user_avatar_assets_created_at_ms_check` CHECK (`created_at_ms` > 0)
);

CREATE INDEX `user_avatar_assets_created_at_ms_idx`
  ON `user_avatar_assets` (`created_at_ms`);
