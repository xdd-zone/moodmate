PRAGMA foreign_keys = ON;

INSERT INTO `applications` (`id`, `code`, `name`, `status`, `created_at_ms`, `updated_at_ms`)
VALUES (
  '019f6973-0136-771e-906c-95085849ce6d',
  'admin',
  'Moodmate Admin',
  'active',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
)
ON CONFLICT (`code`) DO NOTHING;

INSERT INTO `applications` (`id`, `code`, `name`, `status`, `created_at_ms`, `updated_at_ms`)
VALUES (
  '019f6973-0137-749a-bfdd-d1b48c6d93dd',
  'web',
  'Moodmate Web',
  'active',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
)
ON CONFLICT (`code`) DO NOTHING;

INSERT INTO `application_auth_methods` (`id`, `application_id`, `provider`, `enabled`, `created_at_ms`, `updated_at_ms`)
SELECT
  '019f6973-0137-749a-bfdd-d1b48c6d93dc',
  `id`,
  'password',
  1,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `applications`
WHERE `code` = 'admin'
ON CONFLICT (`application_id`, `provider`) DO NOTHING;

INSERT INTO `application_auth_methods` (`id`, `application_id`, `provider`, `enabled`, `created_at_ms`, `updated_at_ms`)
SELECT
  '019f8276-71f6-78a0-8d47-1f98f427bca1',
  `id`,
  'password',
  1,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `applications`
WHERE `code` = 'web'
ON CONFLICT (`application_id`, `provider`) DO NOTHING;

INSERT INTO `application_auth_methods` (`id`, `application_id`, `provider`, `enabled`, `created_at_ms`, `updated_at_ms`)
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

INSERT INTO `roles` (`id`, `application_id`, `code`, `name`, `status`, `created_at_ms`, `updated_at_ms`)
SELECT
  '019f6973-0137-749a-bfdd-d1b519b18016',
  `id`,
  'admin_owner',
  'Admin Owner',
  'active',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `applications`
WHERE `code` = 'admin'
ON CONFLICT (`application_id`, `code`) DO NOTHING;

INSERT INTO `roles` (`id`, `application_id`, `code`, `name`, `status`, `created_at_ms`, `updated_at_ms`)
SELECT
  '019f6973-0137-749a-bfdd-d1b519b18017',
  `id`,
  'web_user',
  'Web User',
  'active',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `applications`
WHERE `code` = 'web'
ON CONFLICT (`application_id`, `code`) DO NOTHING;

INSERT INTO `users` (`id`, `status`, `display_name`, `created_at_ms`, `updated_at_ms`)
VALUES (
  '019f6973-0137-749a-bfdd-d1b6ad73db31',
  'active',
  'Local Admin',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
)
ON CONFLICT (`id`) DO NOTHING;

INSERT INTO `user_emails` (
  `id`, `user_id`, `email`, `normalized_email`, `is_primary`, `is_verified`,
  `verified_at_ms`, `source`, `created_at_ms`, `updated_at_ms`
)
VALUES (
  '019f6973-0137-749a-bfdd-d1b73c6d1061',
  '019f6973-0137-749a-bfdd-d1b6ad73db31',
  'admin@moodmate.local',
  'admin@moodmate.local',
  1,
  1,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  'system',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
)
ON CONFLICT (`normalized_email`) DO NOTHING;

INSERT INTO `password_credentials` (
  `id`, `user_id`, `email_id`, `password_hash`, `password_algo`,
  `password_updated_at_ms`, `failed_attempts`, `must_reset_password`,
  `created_at_ms`, `updated_at_ms`
)
SELECT
  '019f6973-0137-749a-bfdd-d1b87dc04795',
  `user_id`,
  `id`,
  '$pbkdf2-sha256$v=1$i=600000,l=32$1yeY9TynOMLd6WFYAEVeTg$fvlWlGM4RF96SP7R24uEyHU4ux49YFac_yybnsCgYv0',
  'pbkdf2-sha256',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  0,
  0,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `user_emails`
WHERE `normalized_email` = 'admin@moodmate.local'
ON CONFLICT (`user_id`) DO NOTHING;

INSERT INTO `user_role_bindings` (
  `id`, `user_id`, `role_id`, `status`, `granted_at_ms`, `created_at_ms`, `updated_at_ms`
)
SELECT
  '019f6973-0137-749a-bfdd-d1b95df603c2',
  email.`user_id`,
  role.`id`,
  'active',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `user_emails` AS email
INNER JOIN `roles` AS role ON role.`code` = 'admin_owner'
INNER JOIN `applications` AS application
  ON application.`id` = role.`application_id` AND application.`code` = 'admin'
WHERE email.`normalized_email` = 'admin@moodmate.local'
ON CONFLICT (`user_id`, `role_id`) DO NOTHING;

INSERT INTO `user_role_bindings` (
  `id`, `user_id`, `role_id`, `status`, `granted_at_ms`, `created_at_ms`, `updated_at_ms`
)
SELECT
  '019f8276-71f7-76ac-863a-a76495291f43',
  email.`user_id`,
  role.`id`,
  'active',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `user_emails` AS email
INNER JOIN `roles` AS role ON role.`code` = 'web_user'
INNER JOIN `applications` AS application
  ON application.`id` = role.`application_id` AND application.`code` = 'web'
WHERE email.`normalized_email` = 'admin@moodmate.local'
ON CONFLICT (`user_id`, `role_id`) DO NOTHING;
