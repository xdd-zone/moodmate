import { BizCode } from "@repo/contracts";

import { refreshAdmin } from "@/src/server/auth/api";
import {
  failureResponse,
  jsonResponse,
  upstreamFailureResponse,
} from "@/src/server/auth/bff-response";
import {
  clearAdminAuthCookies,
  readAdminAuthCookies,
  setAdminAuthCookies,
} from "@/src/server/auth/cookies";
import { validateSameOrigin } from "@/src/server/auth/origin";

export async function POST(request: Request) {
  const invalidOrigin = validateSameOrigin(request);
  if (invalidOrigin) {
    return invalidOrigin;
  }

  const { cookieStore, refreshToken } = await readAdminAuthCookies();
  if (!refreshToken) {
    clearAdminAuthCookies(cookieStore);
    return failureResponse(
      BizCode.AUTH_REFRESH_MISSING,
      "登录状态已失效，请重新登录",
      401,
    );
  }

  try {
    const result = await refreshAdmin({ refreshToken });
    if (!result.body.ok) {
      clearAdminAuthCookies(cookieStore);
      return jsonResponse(result.body, result.status);
    }

    setAdminAuthCookies(cookieStore, result.body.data);

    return jsonResponse(
      {
        ...result.body,
        data: result.body.data.session,
      },
      result.status,
    );
  } catch (error) {
    clearAdminAuthCookies(cookieStore);
    return upstreamFailureResponse(error);
  }
}
