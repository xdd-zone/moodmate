import { AdminPasswordLoginRequestSchema } from "@repo/contracts";

import { loginAdmin } from "@/src/server/auth/api";
import {
  jsonResponse,
  parseJsonRequest,
  upstreamFailureResponse,
} from "@/src/server/auth/bff-response";
import {
  readAdminAuthCookies,
  setAdminAuthCookies,
} from "@/src/server/auth/cookies";
import { validateSameOrigin } from "@/src/server/auth/origin";

export async function POST(request: Request) {
  const invalidOrigin = validateSameOrigin(request);
  if (invalidOrigin) {
    return invalidOrigin;
  }

  const parsed = await parseJsonRequest(
    request,
    AdminPasswordLoginRequestSchema,
  );
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const result = await loginAdmin(parsed.data);
    if (!result.body.ok) {
      return jsonResponse(result.body, result.status);
    }

    const { cookieStore } = await readAdminAuthCookies();
    setAdminAuthCookies(cookieStore, result.body.data);

    return jsonResponse(
      {
        ...result.body,
        data: result.body.data.session,
      },
      result.status,
    );
  } catch (error) {
    return upstreamFailureResponse(error);
  }
}
