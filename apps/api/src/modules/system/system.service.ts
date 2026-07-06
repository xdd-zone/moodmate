import type {
  HealthResponse,
  PingResponse,
  RootResponse,
} from "@repo/contracts";

import { getApiEnv } from "../../shared/env";
import type { ApiBindings } from "../../shared/hono-env";

export function getRootInfo(bindings: ApiBindings): RootResponse {
  const env = getApiEnv(bindings);

  return {
    name: env.SERVICE_NAME,
    status: "ok",
  };
}

export function getHealthStatus(bindings: ApiBindings): HealthResponse {
  const env = getApiEnv(bindings);

  return {
    env: env.APP_ENV,
    service: env.SERVICE_NAME,
    status: "ok",
  };
}

export function getPingResult(
  bindings: ApiBindings,
  name: string,
): PingResponse {
  const env = getApiEnv(bindings);

  return {
    env: env.APP_ENV,
    message: `pong, ${name}`,
    service: env.SERVICE_NAME,
  };
}
