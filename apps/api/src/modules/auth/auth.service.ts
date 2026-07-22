import {
  BizCode,
  type AdminAuthTokenResponse,
  type AdminLogoutResponse,
  type AdminPasswordLoginRequest,
  type AdminSession,
  type WebAuthTokenResponse,
  type WebPasswordLoginRequest,
  type WebSession,
  type WebUserProfile,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import { AppError } from "@/shared/app-error";
import { getApiEnv } from "@/shared/env";
import type { ApiBindings } from "@/shared/hono-env";
import { presentAdminSession, presentWebSession } from "./auth.presenter";
import {
  createSessionWithRefreshToken,
  findActiveRoles,
  findPasswordLoginContext,
  findRefreshTokenContext,
  findSessionContext,
  findWebOauthLoginContext,
  recordFailedPasswordAttempt,
  recordSuccessfulOauthLogin,
  recordSuccessfulPasswordLogin,
  revokeSession,
  rotateRefreshToken,
} from "./auth.repository";
import {
  issueAccessToken,
  issueRefreshToken,
  TokenVerificationError,
  verifyAccessToken,
  verifyRefreshToken,
} from "./jwt";
import type { AuthApplication } from "./jwt";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "./password";
import { hashTokenId } from "./token-hash";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_LOCK_THRESHOLD = 5;
const PASSWORD_LOCK_DURATION_MS = 15 * 60 * 1000;
const INVALID_CREDENTIALS_MESSAGE = "邮箱或密码错误";

type SessionPresentationInput = Parameters<typeof presentAdminSession>[0];
type SessionByApplication = {
  admin: AdminSession;
  web: WebSession;
};

interface AuthTokenResponse<TSession> {
  accessToken: string;
  accessTokenExpiresAtMs: number;
  refreshToken: string;
  refreshTokenExpiresAtMs: number;
  session: TSession;
}

interface AuthApplicationConfig<TApplication extends AuthApplication> {
  application: TApplication;
  presentSession: (
    input: SessionPresentationInput,
  ) => SessionByApplication[TApplication];
  requiredRole: string;
}

const ADMIN_AUTH_CONFIG: AuthApplicationConfig<"admin"> = {
  application: "admin",
  presentSession: presentAdminSession,
  requiredRole: "admin_owner",
};

const WEB_AUTH_CONFIG: AuthApplicationConfig<"web"> = {
  application: "web",
  presentSession: presentWebSession,
  requiredRole: "web_user",
};

interface PasswordLoginServiceInput {
  bindings: ApiBindings;
  clientIp?: string;
  payload: { email: string; password: string };
  userAgent?: string;
}

export function loginAdminWithPassword(input: {
  bindings: ApiBindings;
  clientIp?: string;
  payload: AdminPasswordLoginRequest;
  userAgent?: string;
}): Promise<AdminAuthTokenResponse> {
  return loginWithPassword(ADMIN_AUTH_CONFIG, input);
}

export function loginWebWithPassword(input: {
  bindings: ApiBindings;
  clientIp?: string;
  payload: WebPasswordLoginRequest;
  userAgent?: string;
}): Promise<WebAuthTokenResponse> {
  return loginWithPassword(WEB_AUTH_CONFIG, input);
}

export async function createWebSessionForOauthUser(input: {
  applicationId: string;
  bindings: ApiBindings;
  clientIp?: string;
  userAgent?: string;
  userId: string;
}): Promise<WebAuthTokenResponse> {
  const context = await findWebOauthLoginContext(
    input.bindings.DB,
    input.userId,
    input.applicationId,
  );
  const roleRows = await findActiveRoles(
    input.bindings.DB,
    input.userId,
    WEB_AUTH_CONFIG.application,
  );
  const roles = roleRows.map((role) => role.code);

  if (
    !context ||
    context.userStatus !== "active" ||
    context.applicationCode !== WEB_AUTH_CONFIG.application ||
    context.applicationStatus !== "active" ||
    !roles.includes(WEB_AUTH_CONFIG.requiredRole)
  ) {
    throw sessionRevokedError();
  }

  const nowMs = Date.now();
  const result = await issueNewSession(WEB_AUTH_CONFIG, {
    applicationId: input.applicationId,
    bindings: input.bindings,
    clientIp: input.clientIp,
    displayName: context.displayName,
    email: context.email,
    nowMs,
    roles,
    userAgent: input.userAgent,
    userId: input.userId,
  });

  await recordSuccessfulOauthLogin(input.bindings.DB, input.userId, nowMs);

  return result;
}

export async function getAdminSessionFromAccess(
  bindings: ApiBindings,
  authorization: string | undefined,
): Promise<AdminSession> {
  const claims = await readAccessClaims(
    bindings,
    authorization,
    ADMIN_AUTH_CONFIG.application,
  );

  return loadActiveSession(
    ADMIN_AUTH_CONFIG,
    bindings,
    claims.sid,
    claims.sub,
    claims.roles,
  );
}

export async function getWebSessionFromAccess(
  bindings: ApiBindings,
  authorization: string | undefined,
): Promise<WebSession> {
  const claims = await readAccessClaims(
    bindings,
    authorization,
    WEB_AUTH_CONFIG.application,
  );

  return loadActiveSession(
    WEB_AUTH_CONFIG,
    bindings,
    claims.sid,
    claims.sub,
    claims.roles,
  );
}

export function getWebUserProfile(session: WebSession): WebUserProfile {
  return {
    displayName: session.displayName,
    email: session.email,
    roles: session.roles,
    userId: session.userId,
  };
}

export function refreshAdminSession(
  bindings: ApiBindings,
  refreshTokenValue: string,
): Promise<AdminAuthTokenResponse> {
  return refreshSession(ADMIN_AUTH_CONFIG, bindings, refreshTokenValue);
}

export function refreshWebSession(
  bindings: ApiBindings,
  refreshTokenValue: string,
): Promise<WebAuthTokenResponse> {
  return refreshSession(WEB_AUTH_CONFIG, bindings, refreshTokenValue);
}

export async function logoutAdmin(input: {
  authorization?: string;
  bindings: ApiBindings;
  refreshToken: string;
}): Promise<AdminLogoutResponse> {
  const env = getApiEnv(input.bindings);
  let sessionId: string | null = null;

  try {
    const claims = await verifyRefreshToken(
      input.refreshToken,
      env.AUTH_REFRESH_SECRET,
    );
    const context = await findRefreshTokenContext(
      input.bindings.DB,
      await hashTokenId(claims.jti),
    );

    if (
      context?.session.id === claims.sid &&
      context.applicationCode === "admin" &&
      context.session.sessionType === "admin"
    ) {
      sessionId = claims.sid;
    }
  } catch {
    sessionId = null;
  }

  if (!sessionId && input.authorization) {
    try {
      sessionId = (
        await verifyAccessToken(
          readBearerToken(input.authorization),
          env.AUTH_ACCESS_SECRET,
        )
      ).sid;
    } catch {
      sessionId = null;
    }
  }

  if (!sessionId) {
    throw refreshInvalidError();
  }

  await revokeSession(input.bindings.DB, sessionId, Date.now(), "logout");

  return { success: true };
}

async function loginWithPassword<TApplication extends AuthApplication>(
  config: AuthApplicationConfig<TApplication>,
  input: PasswordLoginServiceInput,
): Promise<AuthTokenResponse<SessionByApplication[TApplication]>> {
  const { bindings, payload } = input;
  const nowMs = Date.now();
  const loginContext = await findPasswordLoginContext(
    bindings.DB,
    payload.email,
    config.application,
    config.requiredRole,
  );
  const passwordHash = loginContext?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await verifyPassword(payload.password, passwordHash);
  const isLocked =
    loginContext?.lockedUntilMs != null && loginContext.lockedUntilMs > nowMs;
  const canLogin =
    loginContext != null &&
    passwordMatches &&
    !isLocked &&
    !loginContext.mustResetPassword &&
    loginContext.userStatus === "active";

  if (!canLogin) {
    if (loginContext && !passwordMatches && !isLocked) {
      await recordFailedPasswordAttempt(
        bindings.DB,
        loginContext.credentialId,
        nowMs,
        PASSWORD_LOCK_THRESHOLD,
        PASSWORD_LOCK_DURATION_MS,
      );
    }

    throw invalidCredentialsError();
  }

  const roleRows = await findActiveRoles(
    bindings.DB,
    loginContext.userId,
    config.application,
  );
  const roles = roleRows.map((role) => role.code);
  const result = await issueNewSession(config, {
    applicationId: loginContext.applicationId,
    bindings,
    clientIp: input.clientIp,
    displayName: loginContext.displayName,
    email: loginContext.email,
    nowMs,
    roles,
    userAgent: input.userAgent,
    userId: loginContext.userId,
  });
  await recordSuccessfulPasswordLogin(
    bindings.DB,
    loginContext.credentialId,
    loginContext.userId,
    nowMs,
  );

  return result;
}

async function issueNewSession<TApplication extends AuthApplication>(
  config: AuthApplicationConfig<TApplication>,
  input: {
    applicationId: string;
    bindings: ApiBindings;
    clientIp?: string;
    displayName: string;
    email: string;
    nowMs: number;
    roles: string[];
    userAgent?: string;
    userId: string;
  },
): Promise<AuthTokenResponse<SessionByApplication[TApplication]>> {
  const env = getApiEnv(input.bindings);
  const sessionId = uuidv7();
  const sessionExpiresAtMs = input.nowMs + SESSION_TTL_MS;
  const [accessToken, refreshToken] = await Promise.all([
    issueAccessToken(
      {
        application: config.application,
        roles: input.roles,
        sessionExpiresAtMs,
        sessionId,
        userId: input.userId,
      },
      env.AUTH_ACCESS_SECRET,
      input.nowMs,
    ),
    issueRefreshToken(
      {
        application: config.application,
        sessionExpiresAtMs,
        sessionId,
        userId: input.userId,
      },
      env.AUTH_REFRESH_SECRET,
      input.nowMs,
    ),
  ]);

  await createSessionWithRefreshToken(input.bindings.DB, {
    refreshToken: {
      expiresAtMs: refreshToken.expiresAtMs,
      id: uuidv7(),
      issuedAtMs: input.nowMs,
      jtiHash: await hashTokenId(refreshToken.jti),
      parentTokenId: null,
      sessionId,
    },
    session: {
      applicationId: input.applicationId,
      createdAtMs: input.nowMs,
      expiresAtMs: sessionExpiresAtMs,
      id: sessionId,
      ip: truncate(input.clientIp, 64),
      lastSeenAtMs: input.nowMs,
      sessionType: config.application,
      userAgent: truncate(input.userAgent, 512),
      userId: input.userId,
    },
  });

  return {
    accessToken: accessToken.token,
    accessTokenExpiresAtMs: accessToken.expiresAtMs,
    refreshToken: refreshToken.token,
    refreshTokenExpiresAtMs: refreshToken.expiresAtMs,
    session: config.presentSession({
      displayName: input.displayName,
      email: input.email,
      expiresAtMs: sessionExpiresAtMs,
      roles: input.roles,
      sessionId,
      userId: input.userId,
    }),
  };
}

async function refreshSession<TApplication extends AuthApplication>(
  config: AuthApplicationConfig<TApplication>,
  bindings: ApiBindings,
  refreshTokenValue: string,
): Promise<AuthTokenResponse<SessionByApplication[TApplication]>> {
  const env = getApiEnv(bindings);
  const claims = await verifyRefreshForRequest(
    refreshTokenValue,
    env.AUTH_REFRESH_SECRET,
    config.application,
  );
  const nowMs = Date.now();
  const tokenContext = await findRefreshTokenContext(
    bindings.DB,
    await hashTokenId(claims.jti),
  );

  if (!tokenContext) {
    throw refreshInvalidError();
  }

  if (
    tokenContext.refreshToken.usedAtMs != null ||
    tokenContext.refreshToken.revokedAtMs != null ||
    tokenContext.refreshToken.replacedByTokenId != null
  ) {
    await revokeSession(
      bindings.DB,
      tokenContext.session.id,
      nowMs,
      "refresh_token_replay",
    );
    throw refreshReplayedError();
  }

  if (
    tokenContext.refreshToken.sessionId !== claims.sid ||
    tokenContext.session.userId !== claims.sub ||
    tokenContext.session.sessionType !== config.application ||
    tokenContext.applicationCode !== config.application ||
    tokenContext.applicationStatus !== "active" ||
    tokenContext.userStatus !== "active" ||
    tokenContext.session.revokedAtMs != null ||
    tokenContext.session.expiresAtMs <= nowMs ||
    tokenContext.refreshToken.expiresAtMs <= nowMs ||
    tokenContext.refreshToken.expiresAtMs !== claims.exp * 1000
  ) {
    await revokeSession(
      bindings.DB,
      tokenContext.session.id,
      nowMs,
      "refresh_context_invalid",
    );
    throw sessionRevokedError();
  }

  let session: SessionByApplication[TApplication];

  try {
    session = await loadActiveSession(
      config,
      bindings,
      claims.sid,
      claims.sub,
      [config.requiredRole],
    );
  } catch (error) {
    await revokeSession(
      bindings.DB,
      tokenContext.session.id,
      nowMs,
      "refresh_authorization_invalid",
    );
    throw error;
  }

  const [accessToken, refreshToken] = await Promise.all([
    issueAccessToken(
      {
        application: config.application,
        roles: session.roles,
        sessionExpiresAtMs: tokenContext.session.expiresAtMs,
        sessionId: claims.sid,
        userId: claims.sub,
      },
      env.AUTH_ACCESS_SECRET,
      nowMs,
    ),
    issueRefreshToken(
      {
        application: config.application,
        sessionExpiresAtMs: tokenContext.session.expiresAtMs,
        sessionId: claims.sid,
        userId: claims.sub,
      },
      env.AUTH_REFRESH_SECRET,
      nowMs,
    ),
  ]);
  const rotation = await rotateRefreshToken(bindings.DB, {
    currentTokenId: tokenContext.refreshToken.id,
    newToken: {
      expiresAtMs: refreshToken.expiresAtMs,
      id: uuidv7(),
      issuedAtMs: nowMs,
      jtiHash: await hashTokenId(refreshToken.jti),
      parentTokenId: tokenContext.refreshToken.id,
      sessionId: claims.sid,
    },
    rotatedAtMs: nowMs,
    sessionId: claims.sid,
  });

  if (rotation.status === "rejected") {
    await revokeSession(
      bindings.DB,
      claims.sid,
      Date.now(),
      "refresh_token_replay",
    );
    throw refreshReplayedError();
  }

  return {
    accessToken: accessToken.token,
    accessTokenExpiresAtMs: accessToken.expiresAtMs,
    refreshToken: refreshToken.token,
    refreshTokenExpiresAtMs: refreshToken.expiresAtMs,
    session,
  };
}

async function loadActiveSession<TApplication extends AuthApplication>(
  config: AuthApplicationConfig<TApplication>,
  bindings: ApiBindings,
  sessionId: string,
  expectedUserId: string,
  expectedRoles: readonly string[],
): Promise<SessionByApplication[TApplication]> {
  const nowMs = Date.now();
  const [context, roleRows] = await Promise.all([
    findSessionContext(bindings.DB, sessionId),
    findActiveRoles(bindings.DB, expectedUserId, config.application),
  ]);
  const roles = roleRows.map((role) => role.code);
  const hasExpectedRoles = expectedRoles.every((role) => roles.includes(role));

  if (
    !context ||
    context.session.userId !== expectedUserId ||
    context.session.sessionType !== config.application ||
    context.session.revokedAtMs != null ||
    context.session.expiresAtMs <= nowMs ||
    context.userStatus !== "active" ||
    context.applicationCode !== config.application ||
    context.applicationStatus !== "active" ||
    !roles.includes(config.requiredRole) ||
    !hasExpectedRoles
  ) {
    throw sessionRevokedError();
  }

  return config.presentSession({
    displayName: context.displayName,
    email: context.email,
    expiresAtMs: context.session.expiresAtMs,
    roles,
    sessionId: context.session.id,
    userId: context.session.userId,
  });
}

async function readAccessClaims(
  bindings: ApiBindings,
  authorization: string | undefined,
  application: AuthApplication,
) {
  const token = readBearerToken(authorization);
  const env = getApiEnv(bindings);

  return verifyAccessForRequest(token, env.AUTH_ACCESS_SECRET, application);
}

function readBearerToken(authorization: string | undefined): string {
  if (!authorization) {
    throw new AppError(BizCode.AUTH_ACCESS_MISSING, "缺少 access token", 401);
  }

  const match = /^Bearer ([^\s]+)$/u.exec(authorization);

  if (!match) {
    throw new AppError(BizCode.AUTH_ACCESS_INVALID, "access token 无效", 401);
  }

  return match[1];
}

async function verifyAccessForRequest(
  token: string,
  secret: string,
  application: AuthApplication,
) {
  try {
    return await verifyAccessToken(token, secret, application);
  } catch (error) {
    if (error instanceof TokenVerificationError && error.reason === "expired") {
      throw new AppError(
        BizCode.AUTH_ACCESS_EXPIRED,
        "access token 已过期",
        401,
      );
    }

    throw new AppError(BizCode.AUTH_ACCESS_INVALID, "access token 无效", 401);
  }
}

async function verifyRefreshForRequest(
  token: string,
  secret: string,
  application: AuthApplication,
) {
  try {
    return await verifyRefreshToken(token, secret, application);
  } catch {
    throw refreshInvalidError();
  }
}

function invalidCredentialsError() {
  return new AppError(
    BizCode.AUTH_INVALID_CREDENTIALS,
    INVALID_CREDENTIALS_MESSAGE,
    401,
  );
}

function refreshInvalidError() {
  return new AppError(BizCode.AUTH_REFRESH_INVALID, "refresh token 无效", 401);
}

function refreshReplayedError() {
  return new AppError(
    BizCode.AUTH_REFRESH_REPLAYED,
    "refresh token 已被使用",
    401,
  );
}

function sessionRevokedError() {
  return new AppError(BizCode.AUTH_SESSION_REVOKED, "登录会话已失效", 401);
}

function truncate(value: string | undefined, maxLength: number) {
  return value?.slice(0, maxLength);
}
