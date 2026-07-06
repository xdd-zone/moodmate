import { zValidator } from "@hono/zod-validator";
import { BizCode, PingRequestSchema, buildSuccess } from "@repo/contracts";
import { Hono } from "hono";

import { getHealthStatus, getPingResult, getRootInfo } from "./system.service";
import { AppError } from "../../shared/app-error";
import { createMeta } from "../../shared/meta";
import type { ApiHonoEnv } from "../../shared/hono-env";

export function createSystemRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/", (c) => {
      return c.json(
        buildSuccess(getRootInfo(c.env), createMeta(c.var.requestId)),
      );
    })
    .get("/health", (c) => {
      return c.json(
        buildSuccess(getHealthStatus(c.env), createMeta(c.var.requestId)),
      );
    })
    .post(
      "/rpc/system/ping",
      zValidator("json", PingRequestSchema, (result) => {
        if (result.success) {
          return;
        }

        throw new AppError(
          BizCode.COMMON_INVALID_REQUEST,
          "请求参数无效",
          400,
          result.error.issues,
        );
      }),
      (c) => {
        const payload = c.req.valid("json");

        return c.json(
          buildSuccess(
            getPingResult(c.env, payload.name),
            createMeta(c.var.requestId),
          ),
        );
      },
    );
}

export default createSystemRoute;
