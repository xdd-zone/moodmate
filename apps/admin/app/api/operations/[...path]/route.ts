import { BizCode } from "@repo/contracts";

import { getAdminServerEnv } from "@/src/env/server";
import {
  failureResponse,
  upstreamFailureResponse,
} from "@/src/server/auth/bff-response";
import {
  clearAdminAuthCookies,
  readAdminAuthCookies,
} from "@/src/server/auth/cookies";

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { accessToken, cookieStore } = await readAdminAuthCookies();
  if (!accessToken) {
    clearAdminAuthCookies(cookieStore);
    return failureResponse(
      BizCode.AUTH_ACCESS_MISSING,
      "登录状态已失效，请重新登录",
      401,
    );
  }
  const { path } = await context.params;
  const sourceUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `/rpc/admin/${path.map(encodeURIComponent).join("/")}`,
    getAdminServerEnv().API_BASE_URL,
  );
  upstreamUrl.search = sourceUrl.search;
  try {
    const headers = new Headers({
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    });
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);

    const response = await fetch(upstreamUrl, {
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      cache: "no-store",
      headers,
      method: request.method,
      ...(request.method === "GET" || request.method === "HEAD"
        ? {}
        : { duplex: "half" as const }),
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return upstreamFailureResponse(error, "运营数据服务暂时不可用，请稍后重试");
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
