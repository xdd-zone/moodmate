import {
  BizCode,
  WebGithubAuthUrlResponseSchema,
  type WebGithubTicketLoginResponse,
} from "@repo/contracts";
import type { Context } from "hono";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { AppError } from "@/shared/app-error";
import { getApiEnv } from "@/shared/env";
import type { ApiHonoEnv } from "@/shared/hono-env";

import { decodeBase64Url, encodeBase64Url } from "./base64-url";
import {
  consumeOauthLoginTicket,
  createGithubWebUser,
  ensureUserHasRole,
  findAuthUserByNormalizedEmail,
  findWebGithubLoginSetup,
  findWebUserByGithubAccount,
  insertOauthLoginTicket,
  linkGithubAccountToUser,
  updateGithubAccountLogin,
} from "./auth.repository";
import { createWebSessionForOauthUser } from "./auth.service";
import { hashTokenId } from "./token-hash";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_USER_EMAILS_URL = "https://api.github.com/user/emails";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_TICKET_TTL_MS = 2 * 60 * 1000;

const GithubAccessTokenResponseSchema = z.object({
  access_token: z.string().min(1).optional(),
  error_description: z.string().optional(),
});

const GithubUserSchema = z.object({
  email: z.email().nullable(),
  id: z.number().int().positive(),
  login: z.string().min(1),
  name: z.string().nullable(),
});

const GithubEmailSchema = z.object({
  email: z.email(),
  primary: z.boolean(),
  verified: z.boolean(),
});

type GithubUser = z.infer<typeof GithubUserSchema>;
type GithubEmail = z.infer<typeof GithubEmailSchema>;

interface GithubOauthConfig {
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  webOrigin: string;
}

export async function buildWebGithubAuthUrl(c: Context<ApiHonoEnv>) {
  await requireWebGithubLoginSetup(c.env.DB);
  const env = getApiEnv(c.env);
  const config = getGithubOauthConfig(env);
  const state = await createOauthState(env.AUTH_REFRESH_SECRET);
  const url = new URL(GITHUB_AUTHORIZE_URL);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "true");

  return WebGithubAuthUrlResponseSchema.parse({
    state,
    url: url.toString(),
  });
}

export async function handleWebGithubCallback(c: Context<ApiHonoEnv>) {
  const env = getApiEnv(c.env);
  const config = getGithubOauthConfig(env);
  const callbackResultUrl = new URL("/login/github/callback", config.webOrigin);
  const providerError = c.req.query("error");

  if (providerError) {
    callbackResultUrl.searchParams.set("error", "GitHub 未完成授权");
    return c.redirect(callbackResultUrl.toString());
  }

  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    callbackResultUrl.searchParams.set("error", "GitHub 回调参数不完整");
    return c.redirect(callbackResultUrl.toString());
  }

  try {
    const setup = await requireWebGithubLoginSetup(c.env.DB);

    await verifyOauthState(state, env.AUTH_REFRESH_SECRET);

    const accessToken = await fetchGithubAccessToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri: config.callbackUrl,
    });
    const [githubUser, githubEmails] = await Promise.all([
      fetchGithubJson(GITHUB_USER_URL, accessToken, GithubUserSchema),
      fetchGithubJson(
        GITHUB_USER_EMAILS_URL,
        accessToken,
        z.array(GithubEmailSchema),
      ),
    ]);
    const email = pickVerifiedGithubEmail(githubUser, githubEmails);
    const userId = await resolveGithubWebUser({
      database: c.env.DB,
      email,
      githubUser,
      webRoleId: setup.roleId,
    });
    const ticket = uuidv7();
    const nowMs = Date.now();

    await insertOauthLoginTicket({
      applicationId: setup.applicationId,
      createdAtMs: nowMs,
      database: c.env.DB,
      expiresAtMs: nowMs + OAUTH_TICKET_TTL_MS,
      id: uuidv7(),
      ticketHash: await hashTokenId(ticket),
      userId,
    });

    callbackResultUrl.searchParams.set("ticket", ticket);
    callbackResultUrl.searchParams.set("state", state);
  } catch (error) {
    callbackResultUrl.searchParams.set("error", getCallbackErrorMessage(error));
  }

  return c.redirect(callbackResultUrl.toString());
}

export async function loginWebWithGithubTicket(input: {
  bindings: ApiHonoEnv["Bindings"];
  clientIp?: string;
  ticket: string;
  userAgent?: string;
}): Promise<WebGithubTicketLoginResponse> {
  const ticket = await consumeOauthLoginTicket({
    database: input.bindings.DB,
    nowMs: Date.now(),
    ticketHash: await hashTokenId(input.ticket),
  });

  if (!ticket) {
    throw oauthUnauthorizedError("GitHub 登录凭证无效或已过期");
  }

  return createWebSessionForOauthUser({
    applicationId: ticket.applicationId,
    bindings: input.bindings,
    clientIp: input.clientIp,
    userAgent: input.userAgent,
    userId: ticket.userId,
  });
}

function getGithubOauthConfig(
  env: ReturnType<typeof getApiEnv>,
): GithubOauthConfig {
  if (
    !env.GITHUB_OAUTH_CLIENT_ID ||
    !env.GITHUB_OAUTH_CLIENT_SECRET ||
    !env.GITHUB_OAUTH_CALLBACK_URL ||
    !env.WEB_ORIGIN
  ) {
    throw new AppError(BizCode.AUTH_FORBIDDEN, "GitHub 登录尚未配置", 403);
  }

  return {
    callbackUrl: env.GITHUB_OAUTH_CALLBACK_URL,
    clientId: env.GITHUB_OAUTH_CLIENT_ID,
    clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
    webOrigin: env.WEB_ORIGIN,
  };
}

async function requireWebGithubLoginSetup(database: D1Database | undefined) {
  const setup = await findWebGithubLoginSetup(database);

  if (!setup) {
    throw new AppError(BizCode.AUTH_FORBIDDEN, "GitHub 登录未启用", 403);
  }

  return setup;
}

async function createOauthState(secret: string): Promise<string> {
  const nonce = uuidv7();
  const issuedAtMs = Date.now();
  const payload = `${nonce}.${issuedAtMs}`;
  const key = await importStateKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function verifyOauthState(state: string, secret: string): Promise<void> {
  const [nonce, issuedAtValue, signature, extra] = state.split(".");
  const issuedAtMs = Number(issuedAtValue);
  const ageMs = Date.now() - issuedAtMs;

  if (
    !nonce ||
    !signature ||
    extra !== undefined ||
    !Number.isFinite(issuedAtMs) ||
    ageMs < 0 ||
    ageMs > OAUTH_STATE_TTL_MS
  ) {
    throw oauthUnauthorizedError("GitHub 登录状态无效或已过期");
  }

  try {
    const key = await importStateKey(secret, ["verify"]);
    const decodedSignature = decodeBase64Url(signature);
    const signatureBytes = new Uint8Array(decodedSignature.byteLength);
    signatureBytes.set(decodedSignature);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(`${nonce}.${issuedAtMs}`),
    );

    if (!isValid) {
      throw oauthUnauthorizedError("GitHub 登录状态无效或已过期");
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw oauthUnauthorizedError("GitHub 登录状态无效或已过期");
  }
}

function importStateKey(
  secret: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    usages,
  );
}

async function fetchGithubAccessToken(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<string> {
  const response = await fetchGithub(GITHUB_ACCESS_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const payload = GithubAccessTokenResponseSchema.safeParse(
    await readGithubJson(response),
  );

  if (!response.ok || !payload.success || !payload.data.access_token) {
    throw oauthUnauthorizedError("GitHub 授权验证失败");
  }

  return payload.data.access_token;
}

async function fetchGithubJson<T>(
  url: string,
  accessToken: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetchGithub(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "moodmate-web",
      "x-github-api-version": "2022-11-28",
    },
  });
  const payload = schema.safeParse(await readGithubJson(response));

  if (!response.ok || !payload.success) {
    throw oauthUnauthorizedError("无法读取 GitHub 账号资料");
  }

  return payload.data;
}

async function fetchGithub(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new AppError(
      BizCode.SYSTEM_UPSTREAM_TIMEOUT,
      "暂时无法连接 GitHub，请稍后重试",
      504,
      error instanceof Error ? error.message : undefined,
    );
  }
}

async function readGithubJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw oauthUnauthorizedError("GitHub 返回了无效数据");
  }
}

function pickVerifiedGithubEmail(
  user: GithubUser,
  emails: GithubEmail[],
): string {
  const primaryEmail = emails.find((item) => item.primary && item.verified);
  const firstVerifiedEmail = emails.find((item) => item.verified);
  const selectedEmail =
    primaryEmail?.email ?? firstVerifiedEmail?.email ?? user.email;

  if (!selectedEmail) {
    throw oauthUnauthorizedError("GitHub 账号没有已验证邮箱");
  }

  return selectedEmail;
}

async function resolveGithubWebUser(input: {
  database: D1Database | undefined;
  email: string;
  githubUser: GithubUser;
  webRoleId: string;
}): Promise<string> {
  const nowMs = Date.now();
  const providerUserId = String(input.githubUser.id);
  const providerLogin = input.githubUser.login || null;
  const existingGithubUser = await findWebUserByGithubAccount(
    input.database,
    providerUserId,
  );

  if (existingGithubUser) {
    assertActiveGithubUser(existingGithubUser.userStatus);
    await ensureUserHasRole({
      bindingId: uuidv7(),
      database: input.database,
      nowMs,
      roleId: input.webRoleId,
      userId: existingGithubUser.userId,
    });
    await updateGithubAccountLogin({
      database: input.database,
      nowMs,
      providerLogin,
      providerUserId,
    });
    return existingGithubUser.userId;
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const existingEmailUser = await findAuthUserByNormalizedEmail(
    input.database,
    normalizedEmail,
  );

  if (existingEmailUser) {
    assertActiveGithubUser(existingEmailUser.userStatus);
    await linkGithubAccountToUser({
      database: input.database,
      emailId: existingEmailUser.emailId,
      nowMs,
      oauthAccountId: uuidv7(),
      providerLogin,
      providerUserId,
      userId: existingEmailUser.userId,
    });
    await ensureUserHasRole({
      bindingId: uuidv7(),
      database: input.database,
      nowMs,
      roleId: input.webRoleId,
      userId: existingEmailUser.userId,
    });
    return existingEmailUser.userId;
  }

  const userId = uuidv7();

  await createGithubWebUser({
    database: input.database,
    displayName: truncateDisplayName(
      input.githubUser.name?.trim() || input.githubUser.login,
    ),
    email: input.email,
    emailId: uuidv7(),
    normalizedEmail,
    nowMs,
    oauthAccountId: uuidv7(),
    providerLogin,
    providerUserId,
    roleBindingId: uuidv7(),
    userId,
    webRoleId: input.webRoleId,
  });

  return userId;
}

function assertActiveGithubUser(status: "active" | "suspended" | "deleted") {
  if (status !== "active") {
    throw oauthUnauthorizedError("GitHub 账号对应的用户不可用");
  }
}

function truncateDisplayName(value: string): string {
  return Array.from(value).slice(0, 80).join("");
}

function oauthUnauthorizedError(message: string): AppError {
  return new AppError(BizCode.AUTH_INVALID_CREDENTIALS, message, 401);
}

function getCallbackErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  console.error(error);
  return "GitHub 登录失败，请重试";
}
