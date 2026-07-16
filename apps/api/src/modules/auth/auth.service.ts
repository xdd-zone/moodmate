import {
  BizCode,
  type AdminAuthTokenResponse,
  type AdminLogoutResponse,
  type AdminPasswordLoginRequest,
  type AdminSession,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import { AppError } from "@/shared/app-error";
import { getApiEnv } from "@/shared/env";
import type { ApiBindings } from "@/shared/hono-env";
import { presentAdminSession } from "./auth.presenter";
import {
  createSessionWithRefreshToken,
  findActiveAdminRoles,
  findAdminLoginContext,
  findAdminSessionContext,
  findRefreshTokenContext,
  recordFailedPasswordAttempt,
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
import { DUMMY_PASSWORD_HASH, verifyPassword } from "./password";
import { hashTokenId } from "./token-hash";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_LOCK_THRESHOLD = 5;
const PASSWORD_LOCK_DURATION_MS = 15 * 60 * 1000;
const INVALID_CREDENTIALS_MESSAGE = "邮箱或密码错误";

export async function loginAdminWithPassword(input: {
  bindings: ApiBindings;
  clientIp?: string;
  payload: AdminPasswordLoginRequest;
  userAgent?: string;
}): Promise<AdminAuthTokenResponse> {
  const { bindings, payload } = input;
  const env = getApiEnv(bindings);
  const nowMs = Date.now();
  const loginContext = await findAdminLoginContext(bindings.DB, payload.email);
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

  const sessionId = uuidv7();
  const sessionExpiresAtMs = nowMs + SESSION_TTL_MS;
  const [accessToken, refreshToken] = await Promise.all([
    issueAccessToken(
      {
        roles: ["admin_owner"],
        sessionExpiresAtMs,
        sessionId,
        userId: loginContext.userId,
      },
      env.AUTH_ACCESS_SECRET,
      nowMs,
    ),
    issueRefreshToken(
      {
        sessionExpiresAtMs,
        sessionId,
        userId: loginContext.userId,
      },
      env.AUTH_REFRESH_SECRET,
      nowMs,
    ),
  ]);

  await createSessionWithRefreshToken(bindings.DB, {
    refreshToken: {
      expiresAtMs: refreshToken.expiresAtMs,
      id: uuidv7(),
      issuedAtMs: nowMs,
      jtiHash: await hashTokenId(refreshToken.jti),
      parentTokenId: null,
      sessionId,
    },
    session: {
      applicationId: loginContext.applicationId,
      createdAtMs: nowMs,
      expiresAtMs: sessionExpiresAtMs,
      id: sessionId,
      ip: truncate(input.clientIp, 64),
      lastSeenAtMs: nowMs,
      sessionType: "admin",
      userAgent: truncate(input.userAgent, 512),
      userId: loginContext.userId,
    },
  });
  await recordSuccessfulPasswordLogin(
    bindings.DB,
    loginContext.credentialId,
    loginContext.userId,
    nowMs,
  );

  return {
    accessToken: accessToken.token,
    accessTokenExpiresAtMs: accessToken.expiresAtMs,
    refreshToken: refreshToken.token,
    refreshTokenExpiresAtMs: refreshToken.expiresAtMs,
    session: presentAdminSession({
      displayName: loginContext.displayName,
      email: loginContext.email,
      expiresAtMs: sessionExpiresAtMs,
      sessionId,
      userId: loginContext.userId,
    }),
  };
}

export async function getAdminSessionFromAccess(
  bindings: ApiBindings,
  authorization: string | undefined,
): Promise<AdminSession> {
  const token = readBearerToken(authorization);
  const env = getApiEnv(bindings);
  const claims = await verifyAccessForRequest(token, env.AUTH_ACCESS_SECRET);

  return loadActiveAdminSession(bindings, claims.sid, claims.sub, claims.roles);
}

export async function refreshAdminSession(
  bindings: ApiBindings,
  refreshTokenValue: string,
): Promise<AdminAuthTokenResponse> {
  const env = getApiEnv(bindings);
  const claims = await verifyRefreshForRequest(
    refreshTokenValue,
    env.AUTH_REFRESH_SECRET,
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
    tokenContext.applicationCode !== "admin" ||
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

  let session: AdminSession;

  try {
    session = await loadActiveAdminSession(bindings, claims.sid, claims.sub, [
      "admin_owner",
    ]);
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

    if (context?.session.id === claims.sid) {
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

async function loadActiveAdminSession(
  bindings: ApiBindings,
  sessionId: string,
  expectedUserId: string,
  expectedRoles: readonly string[],
): Promise<AdminSession> {
  const nowMs = Date.now();
  const [context, roleRows] = await Promise.all([
    findAdminSessionContext(bindings.DB, sessionId),
    findActiveAdminRoles(bindings.DB, expectedUserId),
  ]);
  const roles = roleRows.map((role) => role.code);

  if (
    !context ||
    context.session.userId !== expectedUserId ||
    context.session.sessionType !== "admin" ||
    context.session.revokedAtMs != null ||
    context.session.expiresAtMs <= nowMs ||
    context.userStatus !== "active" ||
    context.applicationCode !== "admin" ||
    context.applicationStatus !== "active" ||
    !roles.includes("admin_owner") ||
    expectedRoles.length !== 1 ||
    expectedRoles[0] !== "admin_owner"
  ) {
    throw sessionRevokedError();
  }

  return presentAdminSession({
    displayName: context.displayName,
    email: context.email,
    expiresAtMs: context.session.expiresAtMs,
    sessionId: context.session.id,
    userId: context.session.userId,
  });
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

async function verifyAccessForRequest(token: string, secret: string) {
  try {
    return await verifyAccessToken(token, secret);
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

async function verifyRefreshForRequest(token: string, secret: string) {
  try {
    return await verifyRefreshToken(token, secret);
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
