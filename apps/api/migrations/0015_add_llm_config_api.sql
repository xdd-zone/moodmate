ALTER TABLE `llm_provider_configs`
ADD COLUMN `api` text NOT NULL DEFAULT 'openai-chat-completions';
