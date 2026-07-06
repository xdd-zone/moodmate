import type { Hono } from "hono";

import type { ApiHonoEnv } from "../shared/hono-env";

export function registerRequestContext(app: Hono<ApiHonoEnv>) {
  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();

    c.set("requestId", requestId);
    c.set("startedAt", Date.now());
    c.header("x-request-id", requestId);

    await next();
  });
}
