import { BizCode, DefaultAvatarReadQuerySchema } from "@repo/contracts";

import { getDefaultAvatarImage } from "@/src/server/default-avatars/api";
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
  const { accessToken, cookieStore } = await readAdminAuthCookies();
  if (!accessToken) {
    clearAdminAuthCookies(cookieStore);
    return failureResponse(
      BizCode.AUTH_ACCESS_MISSING,
      "登录状态已失效，请重新登录",
      401,
    );
  }

  const url = new URL(request.url);
  const query = DefaultAvatarReadQuerySchema.safeParse({
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
    const upstream = await getDefaultAvatarImage(query.data.key);
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
    return upstreamFailureResponse(error, "默认头像图片暂时不可用，请稍后重试");
  }
}
