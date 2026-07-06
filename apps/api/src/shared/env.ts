import type { ApiEnvValue } from "@repo/contracts";

import type { ApiBindings } from "./hono-env";

export interface ApiEnv {
  APP_ENV: ApiEnvValue;
  CORS_ORIGINS: string[];
  SERVICE_NAME: "api";
}

export function getApiEnv(bindings: ApiBindings): ApiEnv {
  return {
    APP_ENV: parseAppEnv(bindings.APP_ENV),
    CORS_ORIGINS: parseList(bindings.CORS_ORIGINS),
    SERVICE_NAME: "api",
  };
}

function parseAppEnv(value: string | undefined): ApiEnvValue {
  if (value === "test" || value === "production") {
    return value;
  }

  return "development";
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
