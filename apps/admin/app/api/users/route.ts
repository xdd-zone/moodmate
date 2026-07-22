import {
  BizCode,
  UserCreateRequestSchema,
  UserListQuerySchema,
} from "@repo/contracts";

import { createUser, listUsers } from "@/src/server/users/api";
import {
  failureResponse,
  jsonResponse,
  parseJsonRequest,
  upstreamFailureResponse,
} from "@/src/server/auth/bff-response";
import {
  clearAdminAuthCookies,
  readAdminAuthCookies,
} from "@/src/server/auth/cookies";
import { validateSameOrigin } from "@/src/server/auth/origin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = UserListQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });

  if (!query.success) {
    return failureResponse(
      BizCode.COMMON_INVALID_REQUEST,
      "分页参数无效",
      400,
      query.error.issues,
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
    const result = await listUsers(accessToken, query.data);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error, "用户服务暂时不可用，请稍后重试");
  }
}

export async function POST(request: Request) {
  const invalidOrigin = validateSameOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const parsed = await parseJsonRequest(request, UserCreateRequestSchema);
  if (!parsed.ok) return parsed.response;

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
    const result = await createUser(accessToken, parsed.data);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error, "用户服务暂时不可用，请稍后重试");
  }
}
