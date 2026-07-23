CREATE TABLE `llm_provider_configs` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `provider_name` text NOT NULL,
  `base_url` text NOT NULL,
  `model` text NOT NULL,
  `api_key_ciphertext` text NOT NULL,
  `api_key_iv` text NOT NULL,
  `api_key_last4` text NOT NULL,
  `disable_thinking` integer NOT NULL DEFAULT 0,
  `is_active` integer NOT NULL DEFAULT 0,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  CONSTRAINT `llm_provider_configs_disable_thinking_check` CHECK (`disable_thinking` IN (0, 1)),
  CONSTRAINT `llm_provider_configs_is_active_check` CHECK (`is_active` IN (0, 1)),
  CONSTRAINT `llm_provider_configs_timestamps_check` CHECK (`updated_at_ms` >= `created_at_ms`)
);

CREATE UNIQUE INDEX `llm_provider_configs_active_unique`
ON `llm_provider_configs` (`is_active`) WHERE `is_active` = 1;

CREATE INDEX `llm_provider_configs_created_idx`
ON `llm_provider_configs` (`created_at_ms`);
