import { zValidator } from "@hono/zod-validator";
import { BizCode, CompanionChatRequestSchema } from "@repo/contracts";
import { Hono } from "hono";

import { requireWebAccess } from "@/modules/auth/auth.middleware";
import { AppError } from "@/shared/app-error";
import type { ApiHonoEnv } from "@/shared/hono-env";
import { createCompanionTextStream } from "./chat.provider";
import { prepareCompanionChat } from "./chat.service";

export function createChatRoute() {
  return new Hono<ApiHonoEnv>().post(
    "/rpc/chat/companion",
    requireWebAccess,
    zValidator("json", CompanionChatRequestSchema, (result) => {
      if (result.success) return;

      throw new AppError(
        BizCode.COMMON_INVALID_REQUEST,
        "聊天请求内容无效",
        400,
        result.error.issues,
      );
    }),
    async (c) => {
      const payload = c.req.valid("json");
      const chat = prepareCompanionChat({
        bindings: c.env,
        llmConfig: payload.llmConfig,
        messages: payload.messages,
      });
      const stream = await createCompanionTextStream({
        ...chat,
        signal: c.req.raw.signal,
      });

      return c.body(stream, 200, {
        "cache-control": "no-cache, no-transform",
        "content-type": "text/plain; charset=utf-8",
        "x-accel-buffering": "no",
      });
    },
  );
}

export default createChatRoute;
