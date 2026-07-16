import { ApiEnvSchema, type ApiEnvValue } from "@repo/contracts";

import type { ApiBindings } from "./hono-env";

export interface ApiEnv {
  APP_ENV: ApiEnvValue;
  AUTH_ACCESS_SECRET: string;
  AUTH_REFRESH_SECRET: string;
  CORS_ORIGINS: string[];
  SERVICE_NAME: "api";
}

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
    SERVICE_NAME: "api",
  };
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
