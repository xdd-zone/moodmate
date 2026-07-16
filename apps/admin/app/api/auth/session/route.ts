import { BizCode } from "@repo/contracts";

import { getAdminSession } from "@/src/server/auth/api";
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
    const result = await getAdminSession(accessToken);

    if (
      !result.body.ok &&
      result.body.error.code !== BizCode.AUTH_ACCESS_EXPIRED
    ) {
      clearAdminAuthCookies(cookieStore);
    }

    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error);
  }
}
