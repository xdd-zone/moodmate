import { BizCode, LlmConfigCreateRequestSchema } from "@repo/contracts";

import {
  createLlmConfig,
  listLlmConfigs,
} from "@/src/server/llm-configs/api";
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

export async function GET() {
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
    const result = await listLlmConfigs(accessToken);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error, "模型配置服务暂时不可用，请稍后重试");
  }
}

export async function POST(request: Request) {
  const invalidOrigin = validateSameOrigin(request);
  if (invalidOrigin) {
    return invalidOrigin;
  }

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

  const parsed = LlmConfigCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return failureResponse(
      BizCode.COMMON_INVALID_REQUEST,
      "模型配置参数无效",
      400,
      parsed.error.issues,
    );
  }

  try {
    const result = await createLlmConfig(accessToken, parsed.data);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error, "模型配置服务暂时不可用，请稍后重试");
  }
}
