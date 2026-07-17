import { Hono } from "hono";

import { createAssetsRoute } from "@/modules/assets";
import { createAuthRoute } from "@/modules/auth";
import { createSystemRoute } from "@/modules/system";
import { createRoleRoute } from "@/modules/roles";
import type { ApiHonoEnv } from "@/shared/hono-env";

export function createRoutes() {
  return new Hono<ApiHonoEnv>()
    .route("/", createSystemRoute())
    .route("/", createAuthRoute())
    .route("/", createRoleRoute())
    .route("/", createAssetsRoute());
}

export type ApiRoutesType = ReturnType<typeof createRoutes>;

export default createRoutes;
