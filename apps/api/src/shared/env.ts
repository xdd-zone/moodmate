import { ApiEnvSchema, type ApiEnvValue } from "@repo/contracts";

import type { ApiBindings } from "./hono-env";

export interface ApiEnv {
  APP_ENV: ApiEnvValue;
  AUTH_ACCESS_SECRET: string;
  AUTH_REFRESH_SECRET: string;
  CORS_ORIGINS: string[];
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL: string;
  DEEPSEEK_MODEL: string;
  GITHUB_OAUTH_CALLBACK_URL?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  SERVICE_NAME: "api";
  WEB_ORIGIN?: string;
}

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

export function getApiEnv(bindings: ApiBindings): ApiEnv {
  const appEnv = parseAppEnv(bindings.APP_ENV);

  return {
    APP_ENV: appEnv,
    AUTH_ACCESS_SECRET: parseSecret(
      bindings.AUTH_ACCESS_SECRET,
      "AUTH_ACCESS_SECRET",
    ),
    AUTH_REFRESH_SECRET: parseSecret(
      bindings.AUTH_REFRESH_SECRET,
      "AUTH_REFRESH_SECRET",
    ),
    CORS_ORIGINS: parseCorsOrigins(bindings.CORS_ORIGINS, appEnv),
    DEEPSEEK_API_KEY: parseOptionalValue(bindings.DEEPSEEK_API_KEY),
    DEEPSEEK_BASE_URL: parseHttpUrl(
      bindings.DEEPSEEK_BASE_URL ?? DEFAULT_DEEPSEEK_BASE_URL,
      "DEEPSEEK_BASE_URL",
    ),
    DEEPSEEK_MODEL:
      parseOptionalValue(bindings.DEEPSEEK_MODEL) ?? DEFAULT_DEEPSEEK_MODEL,
    GITHUB_OAUTH_CALLBACK_URL: parseOptionalHttpUrl(
      bindings.GITHUB_OAUTH_CALLBACK_URL,
      "GITHUB_OAUTH_CALLBACK_URL",
    ),
    GITHUB_OAUTH_CLIENT_ID: parseOptionalValue(bindings.GITHUB_OAUTH_CLIENT_ID),
    GITHUB_OAUTH_CLIENT_SECRET: parseOptionalValue(
      bindings.GITHUB_OAUTH_CLIENT_SECRET,
    ),
    SERVICE_NAME: "api",
    WEB_ORIGIN: parseOptionalHttpUrl(bindings.WEB_ORIGIN, "WEB_ORIGIN"),
  };
}

function parseOptionalValue(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue || undefined;
}

function parseHttpUrl(value: string, name: string): string {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} 必须是有效的 HTTP URL。`);
  }
}

function parseOptionalHttpUrl(
  value: string | undefined,
  name: string,
): string | undefined {
  const normalizedValue = parseOptionalValue(value);
  return normalizedValue ? parseHttpUrl(normalizedValue, name) : undefined;
}

function parseSecret(value: string | undefined, name: string): string {
  if (!value || new TextEncoder().encode(value).byteLength < 32) {
    throw new Error(`${name} 必须至少包含 32 个 UTF-8 字节。`);
  }

  return value;
}

function parseAppEnv(value: string | undefined): ApiEnvValue {
  const result = ApiEnvSchema.safeParse(value);

  if (!result.success) {
    throw new Error("APP_ENV 必须是 development、test 或 production 之一。");
  }

  return result.data;
}

function parseCorsOrigins(
  value: string | undefined,
  appEnv: ApiEnvValue,
): string[] {
  const origins = value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map(parseCorsOrigin)
    : [];

  if (appEnv === "production" && origins.length === 0) {
    throw new Error("production 环境必须配置 CORS_ORIGINS。");
  }

  return [...new Set(origins)];
}

function parseCorsOrigin(value: string): string {
  try {
    const url = new URL(value);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const hasOnlyOrigin = url.pathname === "/" && !url.search && !url.hash;

    if (!isHttp || !hasOnlyOrigin) {
      throw new Error();
    }

    return url.origin;
  } catch {
    throw new Error(`CORS_ORIGINS 包含无效来源：${value}`);
  }
}
