import { AdminLogoutResponseSchema } from "@repo/contracts";

import { logoutAdmin } from "@/src/server/auth/api";
import { successResponse } from "@/src/server/auth/bff-response";
import {
  clearAdminAuthCookies,
  readAdminAuthCookies,
} from "@/src/server/auth/cookies";
import { validateSameOrigin } from "@/src/server/auth/origin";

export async function POST(request: Request) {
  const invalidOrigin = validateSameOrigin(request);
  if (invalidOrigin) {
    return invalidOrigin;
  }

  const { accessToken, cookieStore, refreshToken } =
    await readAdminAuthCookies();

  try {
    if (refreshToken) {
      await logoutAdmin({ refreshToken }, accessToken);
    }
  } catch {
    // 本地登出必须清理浏览器凭证，不依赖上游 token 是否仍然有效。
  } finally {
    clearAdminAuthCookies(cookieStore);
  }

  return successResponse(AdminLogoutResponseSchema.parse({ success: true }));
}
