import type { MiddlewareHandler } from "hono";

import type { ApiHonoEnv } from "@/shared/hono-env";
import {
  getAdminSessionFromAccess,
  getWebSessionFromAccess,
} from "./auth.service";

export const requireAdminAccess: MiddlewareHandler<ApiHonoEnv> = async (
  c,
  next,
) => {
  const session = await getAdminSessionFromAccess(
    c.env,
    c.req.header("Authorization"),
  );

  c.set("adminSession", session);
  await next();
};

export const requireWebAccess: MiddlewareHandler<ApiHonoEnv> = async (
  c,
  next,
) => {
  const session = await getWebSessionFromAccess(
    c.env,
    c.req.header("Authorization"),
  );

  c.set("webSession", session);
  await next();
};
