import {
  WebPasswordLoginResponseSchema,
  type WebPasswordLoginRequest,
} from "@repo/contracts";

import { http } from "@/src/lib/http";

import { saveClientSession } from "./client-session";

export async function loginWeb(payload: WebPasswordLoginRequest) {
  const response = await http.post(
    "/auth/web/password/login",
    payload,
    WebPasswordLoginResponseSchema,
  );

  saveClientSession(response);
  return response.session;
}
