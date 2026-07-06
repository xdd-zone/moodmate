import { Hono } from "hono";

import { createSystemRoute } from "../modules/system";
import type { ApiHonoEnv } from "../shared/hono-env";

export function createRoutes() {
  return new Hono<ApiHonoEnv>().route("/", createSystemRoute());
}

export type ApiRoutesType = ReturnType<typeof createRoutes>;

export default createRoutes;
