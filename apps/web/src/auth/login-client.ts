import {
  WebPasswordLoginResponseSchema,
  type WebGithubTicketLoginRequest,
  type WebPasswordLoginRequest,
} from "@repo/contracts";

import {
  getWebGithubAuthUrl,
  loginWithWebGithubTicket,
} from "@/src/api/github-auth.api";
import { http } from "@/src/lib/http";

import { saveClientSession } from "./client-session";

const GITHUB_OAUTH_STATE_STORAGE_KEY = "web:github-oauth-state";

export async function loginWeb(payload: WebPasswordLoginRequest) {
  const response = await http.post(
    "/auth/web/password/login",
    payload,
    WebPasswordLoginResponseSchema,
  );

  saveClientSession(response);
  return response.session;
}

export async function redirectToGithubLogin(): Promise<void> {
  const response = await getWebGithubAuthUrl();

  window.sessionStorage.setItem(GITHUB_OAUTH_STATE_STORAGE_KEY, response.state);
  window.location.assign(response.url);
}

export async function loginWebWithGithubTicket(
  payload: WebGithubTicketLoginRequest,
) {
  const response = await loginWithWebGithubTicket(payload);

  saveClientSession(response);
  return response.session;
}

export function consumeStoredGithubOauthState(): string | null {
  const state = window.sessionStorage.getItem(GITHUB_OAUTH_STATE_STORAGE_KEY);

  window.sessionStorage.removeItem(GITHUB_OAUTH_STATE_STORAGE_KEY);
  return state;
}
