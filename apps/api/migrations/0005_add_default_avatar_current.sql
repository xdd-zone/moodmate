ALTER TABLE `default_avatar_versions`
  ADD COLUMN `is_current` integer NOT NULL DEFAULT 0
  CHECK (`is_current` IN (0, 1));

UPDATE `default_avatar_versions`
SET `is_current` = 1
WHERE `id` = (
  SELECT `id`
  FROM `default_avatar_versions`
  ORDER BY `created_at_ms` DESC, `id` DESC
  LIMIT 1
);

CREATE UNIQUE INDEX `default_avatar_versions_current_unique`
  ON `default_avatar_versions` (`is_current`)
  WHERE `is_current` = 1;
