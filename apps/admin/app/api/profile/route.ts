import { BizCode } from "@repo/contracts";

import { getProfile } from "@/src/server/profile/api";
import {
  failureResponse,
  jsonResponse,
  upstreamFailureResponse,
} from "@/src/server/auth/bff-response";
import {
  clearAdminAuthCookies,
  readAdminAuthCookies,
} from "@/src/server/auth/cookies";

export async function GET() {
  const { accessToken, cookieStore, refreshToken } =
    await readAdminAuthCookies();
  if (!accessToken) {
    if (refreshToken) {
      return failureResponse(
        BizCode.AUTH_ACCESS_EXPIRED,
        "登录凭证已到期，正在续期",
        401,
      );
    }

    clearAdminAuthCookies(cookieStore);
    return failureResponse(
      BizCode.AUTH_ACCESS_MISSING,
      "登录状态已失效，请重新登录",
      401,
    );
  }

  try {
    const result = await getProfile(accessToken);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(
      error,
      "管理员资料服务暂时不可用，请稍后重试",
    );
  }
}
