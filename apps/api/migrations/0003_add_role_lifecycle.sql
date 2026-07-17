ALTER TABLE `roles`
  ADD COLUMN `status` text NOT NULL DEFAULT 'active'
  CHECK (`status` IN ('active', 'disabled', 'deleted'));
ALTER TABLE `roles` ADD COLUMN `disabled_at_ms` integer;
ALTER TABLE `roles` ADD COLUMN `deleted_at_ms` integer;

CREATE INDEX `roles_application_status_idx`
  ON `roles` (`application_id`, `status`);
