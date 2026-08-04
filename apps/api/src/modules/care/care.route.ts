import { zValidator } from "@hono/zod-validator";
import {
  BizCode,
  CompanionCareEventsResponseSchema,
  CompanionCarePlanResponseSchema,
  GenerateCompanionCareEventRequestSchema,
  GenerateCompanionCareEventResponseSchema,
  UpsertCompanionCarePlanRequestSchema,
  buildSuccess,
} from "@repo/contracts";
import { Hono } from "hono";

import { requireWebAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createMeta } from "@/shared/meta";

import {
  generateCareEvent,
  getCareEvents,
  getCarePlan,
  updateCarePlan,
} from "./care.service";

function invalid(message: string, details?: unknown) {
  return new AppError(BizCode.COMMON_INVALID_REQUEST, message, 400, details);
}

export function createCareRoute() {
  return new Hono<ApiHonoEnv>()
    .get("/rpc/care-plan", requireWebAccess, async (c) =>
      c.json(
        buildSuccess(
          CompanionCarePlanResponseSchema.parse(
            await getCarePlan({
              bindings: c.env,
              userId: c.var.webSession.userId,
            }),
          ),
          createMeta(c.var.requestId),
        ),
      ),
    )
    .patch(
      "/rpc/care-plan",
      requireWebAccess,
      zValidator("json", UpsertCompanionCarePlanRequestSchema, (result) => {
        if (!result.success)
          throw invalid("关怀计划内容无效", result.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            CompanionCarePlanResponseSchema.parse(
              await updateCarePlan({
                bindings: c.env,
                payload: c.req.valid("json"),
                userId: c.var.webSession.userId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    )
    .get("/rpc/care-events", requireWebAccess, async (c) =>
      c.json(
        buildSuccess(
          CompanionCareEventsResponseSchema.parse(
            await getCareEvents({
              bindings: c.env,
              userId: c.var.webSession.userId,
            }),
          ),
          createMeta(c.var.requestId),
        ),
      ),
    )
    .post(
      "/rpc/care-events/generate",
      requireWebAccess,
      zValidator("json", GenerateCompanionCareEventRequestSchema, (result) => {
        if (!result.success)
          throw invalid("生成关怀请求无效", result.error.issues);
      }),
      async (c) =>
        c.json(
          buildSuccess(
            GenerateCompanionCareEventResponseSchema.parse(
              await generateCareEvent({
                bindings: c.env,
                requestId: c.var.requestId,
                scene: c.req.valid("json").scene,
                signal: c.req.raw.signal,
                userId: c.var.webSession.userId,
              }),
            ),
            createMeta(c.var.requestId),
          ),
        ),
    );
}

export default createCareRoute;
