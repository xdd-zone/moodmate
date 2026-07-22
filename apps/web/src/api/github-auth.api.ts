import {
  WebGithubAuthUrlResponseSchema,
  WebGithubTicketLoginResponseSchema,
} from "@repo/contracts";
import type { WebGithubTicketLoginRequest } from "@repo/contracts";

import { http } from "@/src/lib/http";

export function getWebGithubAuthUrl() {
  return http.get("/auth/web/github/authorize", WebGithubAuthUrlResponseSchema);
}

export function loginWithWebGithubTicket(payload: WebGithubTicketLoginRequest) {
  return http.post(
    "/auth/web/github/ticket/login",
    payload,
    WebGithubTicketLoginResponseSchema,
  );
}
