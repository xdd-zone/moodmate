import { Hono } from "hono";

import { createAgentsRoute } from "@/modules/agents";
import { createAssetsRoute } from "@/modules/assets";
import { createAuthRoute } from "@/modules/auth";
import { createGroupChatRoute } from "@/modules/group-chat";
import { createDirectChatRoute } from "@/modules/direct-chat";
import { createCareRoute } from "@/modules/care";
import { createAdminOperationsRoute } from "@/modules/admin-operations";
import { createLlmConfigRoute } from "@/modules/llm-config";
import { createProfileRoute } from "@/modules/profile";
import { createRoleRoute } from "@/modules/roles";
import { createSystemRoute } from "@/modules/system";
import { createUserRoute } from "@/modules/users";
import type { ApiHonoEnv } from "@/shared/hono-env";

export function createRoutes() {
  return new Hono<ApiHonoEnv>()
    .route("/", createSystemRoute())
    .route("/", createAuthRoute())
    .route("/", createAgentsRoute())
    .route("/", createDirectChatRoute())
    .route("/", createCareRoute())
    .route("/", createAdminOperationsRoute())
    .route("/", createGroupChatRoute())
    .route("/", createLlmConfigRoute())
    .route("/", createProfileRoute())
    .route("/", createRoleRoute())
    .route("/", createUserRoute())
    .route("/", createAssetsRoute());
}

export type ApiRoutesType = ReturnType<typeof createRoutes>;

export default createRoutes;
