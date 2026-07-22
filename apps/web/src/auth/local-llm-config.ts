"use client";

import {
  CompanionChatLlmConfigSchema,
  type CompanionChatLlmConfig,
} from "@repo/contracts";
import { z } from "zod";

const STORAGE_KEY = "web:local-llm-config:v1";
export const LOCAL_LLM_CONFIG_CHANGED_EVENT = "web-local-llm-config-changed";

const LocalLlmConfigSchema = CompanionChatLlmConfigSchema.extend({
  enabled: z.boolean(),
});

export type LocalLlmConfig = z.infer<typeof LocalLlmConfigSchema>;

export function createDefaultLocalLlmConfig(): LocalLlmConfig {
  return {
    enabled: false,
    providerName: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    apiKey: "",
  };
}

export function readLocalLlmConfig(): LocalLlmConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const result = LocalLlmConfigSchema.safeParse(JSON.parse(rawValue));

    if (!result.success) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return normalizeLocalLlmConfig(result.data);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function readEnabledLocalLlmConfig(): CompanionChatLlmConfig | null {
  const config = readLocalLlmConfig();

  if (!config?.enabled) {
    return null;
  }

  return {
    providerName: config.providerName,
    baseURL: config.baseURL,
    model: config.model,
    apiKey: config.apiKey,
  };
}

export function saveLocalLlmConfig(input: LocalLlmConfig): LocalLlmConfig {
  const config = LocalLlmConfigSchema.parse(normalizeLocalLlmConfig(input));

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    notifyConfigChanged();
  }

  return config;
}

export function clearLocalLlmConfig(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  notifyConfigChanged();
}

function normalizeLocalLlmConfig(input: LocalLlmConfig): LocalLlmConfig {
  return {
    enabled: input.enabled,
    providerName: input.providerName.trim(),
    baseURL: input.baseURL.trim().replace(/\/+$/, ""),
    model: input.model.trim(),
    apiKey: input.apiKey.trim(),
  };
}

function notifyConfigChanged(): void {
  window.dispatchEvent(new Event(LOCAL_LLM_CONFIG_CHANGED_EVENT));
}
