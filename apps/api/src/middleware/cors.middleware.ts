import { cors } from "hono/cors";
import type { Hono } from "hono";

import { getApiEnv } from "../shared/env";
import type { ApiHonoEnv } from "../shared/hono-env";

export function registerCors(app: Hono<ApiHonoEnv>) {
  app.use("*", async (c, next) => {
    const env = getApiEnv(c.env);
    const allowedOrigins = new Set(env.CORS_ORIGINS);
    const corsMiddleware = cors({
      allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      origin: (origin) => {
        if (allowedOrigins.size === 0) {
          return origin;
        }

        return allowedOrigins.has(origin) ? origin : null;
      },
    });

    return corsMiddleware(c, next);
  });
}
