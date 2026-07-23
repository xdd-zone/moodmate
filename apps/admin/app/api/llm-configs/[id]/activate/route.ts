import { BizCode } from "@repo/contracts";

import { activateLlmConfig } from "@/src/server/llm-configs/api";
import {
  failureResponse,
  jsonResponse,
  upstreamFailureResponse,
} from "@/src/server/auth/bff-response";
import {
  clearAdminAuthCookies,
  readAdminAuthCookies,
} from "@/src/server/auth/cookies";
import { validateSameOrigin } from "@/src/server/auth/origin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const invalidOrigin = validateSameOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const { accessToken, cookieStore } = await readAdminAuthCookies();
  if (!accessToken) {
    clearAdminAuthCookies(cookieStore);
    return failureResponse(
      BizCode.AUTH_ACCESS_MISSING,
      "登录状态已失效，请重新登录",
      401,
    );
  }

  try {
    const { id } = await context.params;
    const result = await activateLlmConfig(accessToken, id);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error, "模型配置服务暂时不可用，请稍后重试");
  }
}
