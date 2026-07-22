import {
  AdminDefaultAvatarSetCurrentRequestSchema,
  BizCode,
} from "@repo/contracts";

import { setCurrentDefaultAvatar } from "@/src/server/default-avatars/api";
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
  context: { params: Promise<{ versionId: string }> },
) {
  const invalidOrigin = validateSameOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const params = AdminDefaultAvatarSetCurrentRequestSchema.safeParse(
    await context.params,
  );
  if (!params.success) {
    return failureResponse(
      BizCode.COMMON_INVALID_REQUEST,
      "默认头像版本 id 无效",
      400,
      params.error.issues,
    );
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

  try {
    const result = await setCurrentDefaultAvatar(
      accessToken,
      params.data.versionId,
    );
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error, "默认头像服务暂时不可用，请稍后重试");
  }
}
