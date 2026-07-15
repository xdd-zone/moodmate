import type { Hono } from "hono";

import type { ApiHonoEnv } from "@/shared/hono-env";

export function registerSecureHeaders(app: Hono<ApiHonoEnv>) {
  app.use("*", async (c, next) => {
    await next();

    c.header("x-content-type-options", "nosniff");
    c.header("referrer-policy", "strict-origin-when-cross-origin");
  });
}
