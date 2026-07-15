import type {
  HealthResponse,
  PingResponse,
  ReadinessResponse,
  RootResponse,
} from "@repo/contracts";
import { BizCode } from "@repo/contracts";

import { checkD1Readiness } from "@/infra/db/d1";
import { AppError } from "@/shared/app-error";
import { getApiEnv } from "@/shared/env";
import type { ApiBindings } from "@/shared/hono-env";

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

export async function getReadinessStatus(
  bindings: ApiBindings,
): Promise<ReadinessResponse> {
  try {
    await checkD1Readiness(bindings.DB);
  } catch (error) {
    console.error("D1 readiness 检查失败", error);

    throw new AppError(
      BizCode.SYSTEM_DATABASE_UNAVAILABLE,
      "数据库不可用",
      503,
    );
  }

  return {
    status: "ready",
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
