import { BizCode } from "@repo/contracts";

import { uploadDefaultAvatar } from "@/src/server/default-avatars/api";
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

  const { accessToken, cookieStore } = await readAdminAuthCookies();
  if (!accessToken) {
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
    const result = await uploadDefaultAvatar(accessToken, file);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    return upstreamFailureResponse(error, "默认头像服务暂时不可用，请稍后重试");
  }
}
