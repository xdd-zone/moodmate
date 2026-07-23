import { BizCode, LlmConfigUpdateRequestSchema } from "@repo/contracts";

import { updateLlmConfig } from "@/src/server/llm-configs/api";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failureResponse(
      BizCode.COMMON_INVALID_REQUEST,
      "请求内容必须是有效 JSON",
      400,
    );
  }

  const parsed = LlmConfigUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return failureResponse(
      BizCode.COMMON_INVALID_REQUEST,
      "模型配置参数无效",
      400,
      parsed.error.issues,
    );
  }

  try {
    const { id } = await context.params;
    const result = await updateLlmConfig(accessToken, id, parsed.data);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error, "模型配置服务暂时不可用，请稍后重试");
  }
}
