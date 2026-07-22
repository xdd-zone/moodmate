import { BizCode } from "@repo/contracts";

import { uploadProfileAvatar } from "@/src/server/profile/api";
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

export async function POST(request: Request) {
  const invalidOrigin = validateSameOrigin(request);
  if (invalidOrigin) return invalidOrigin;

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failureResponse(
      BizCode.COMMON_INVALID_REQUEST,
      "头像上传请求必须使用 multipart/form-data",
      400,
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return failureResponse(BizCode.COMMON_INVALID_REQUEST, "缺少头像文件", 400);
  }

  try {
    const result = await uploadProfileAvatar(accessToken, file);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error, "个人头像服务暂时不可用，请稍后重试");
  }
}
