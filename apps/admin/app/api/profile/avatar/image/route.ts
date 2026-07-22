import { AdminProfileAvatarReadQuerySchema, BizCode } from "@repo/contracts";

import { getProfileAvatarImage } from "@/src/server/profile/api";
import {
  failureResponse,
  upstreamFailureResponse,
} from "@/src/server/auth/bff-response";
import {
  clearAdminAuthCookies,
  readAdminAuthCookies,
} from "@/src/server/auth/cookies";

const FORWARDED_HEADERS = [
  "cache-control",
  "content-disposition",
  "content-length",
  "content-type",
  "etag",
] as const;

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const query = AdminProfileAvatarReadQuerySchema.safeParse({
    key: url.searchParams.get("key") ?? undefined,
  });
  if (!query.success) {
    return failureResponse(
      BizCode.COMMON_INVALID_REQUEST,
      "头像 key 无效",
      400,
      query.error.issues,
    );
  }

  try {
    const upstream = await getProfileAvatarImage(accessToken, query.data.key);
    const headers = new Headers();

    for (const name of FORWARDED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(upstream.body, {
      headers,
      status: upstream.status,
    });
  } catch (error) {
    return upstreamFailureResponse(error, "个人头像图片暂时不可用，请稍后重试");
  }
}
