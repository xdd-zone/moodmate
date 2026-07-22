import { Hono } from "hono";

import { createAssetsRoute } from "@/modules/assets";
import { createAuthRoute } from "@/modules/auth";
import { createChatRoute } from "@/modules/chat";
import { createProfileRoute } from "@/modules/profile";
import { createRoleRoute } from "@/modules/roles";
import { createSystemRoute } from "@/modules/system";
import { createUserRoute } from "@/modules/users";
import type { ApiHonoEnv } from "@/shared/hono-env";

export function createRoutes() {
  return new Hono<ApiHonoEnv>()
    .route("/", createSystemRoute())
    .route("/", createAuthRoute())
    .route("/", createChatRoute())
    .route("/", createProfileRoute())
    .route("/", createRoleRoute())
    .route("/", createUserRoute())
    .route("/", createAssetsRoute());
}

export type ApiRoutesType = ReturnType<typeof createRoutes>;

export default createRoutes;
