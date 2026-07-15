import { BizCode, buildFailure } from "@repo/contracts";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { registerCors } from "@/middleware/cors.middleware";
import { registerRequestContext } from "@/middleware/request-context.middleware";
import { registerSecureHeaders } from "@/middleware/secure-headers.middleware";
import { createRoutes } from "@/routes";
import { AppError } from "@/shared/app-error";
import { createMeta } from "@/shared/meta";
import type { ApiHonoEnv } from "@/shared/hono-env";

export function createApiApp() {
  const app = new Hono<ApiHonoEnv>();

  registerRequestContext(app);
  registerSecureHeaders(app);
  registerCors(app);

  app.onError((error, c) => {
    const meta = createMeta(c.var.requestId);

    if (error instanceof AppError) {
      return c.json(
        buildFailure(
          {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          meta,
        ),
        error.status,
      );
    }

    if (error instanceof HTTPException) {
      return c.json(
        buildFailure(
          {
            code: BizCode.COMMON_INVALID_REQUEST,
            message: error.message,
          },
          meta,
        ),
        error.status,
      );
    }

    console.error(error);

    return c.json(
      buildFailure(
        {
          code: BizCode.SYSTEM_INTERNAL_ERROR,
          message: "服务内部错误",
        },
        meta,
      ),
      500,
    );
  });

  app.notFound((c) => {
    return c.json(
      buildFailure(
        {
          code: BizCode.COMMON_NOT_FOUND,
          message: "接口不存在",
        },
        createMeta(c.var.requestId),
      ),
      404,
    );
  });

  return app.route("/", createRoutes());
}

export default createApiApp;
