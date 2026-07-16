import { and, eq } from "drizzle-orm";

import { createD1Client } from "@/infra/db/d1";

import {
  applicationAuthMethods,
  applications,
  authSessions,
  passwordCredentials,
  refreshTokens,
  roles,
  userEmails,
  userRoleBindings,
  users,
} from "./auth.schema";
import type {
  NewAuthSessionRecord,
  NewRefreshTokenRecord,
} from "./auth.schema";

export interface CreateSessionInput {
  refreshToken: NewRefreshTokenRecord;
  session: NewAuthSessionRecord;
}

export interface RotateRefreshTokenInput {
  currentTokenId: string;
  newToken: NewRefreshTokenRecord & { parentTokenId: string };
  rotatedAtMs: number;
  sessionId: string;
}

export type RotateRefreshTokenResult =
  | { status: "rejected" }
  | { status: "rotated" };

export async function findAdminLoginContext(
  database: D1Database | undefined,
  normalizedEmail: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      applicationId: applications.id,
      applicationStatus: applications.status,
      credentialId: passwordCredentials.id,
      displayName: users.displayName,
      email: userEmails.email,
      failedAttempts: passwordCredentials.failedAttempts,
      lockedUntilMs: passwordCredentials.lockedUntilMs,
      mustResetPassword: passwordCredentials.mustResetPassword,
      passwordAlgo: passwordCredentials.passwordAlgo,
      passwordHash: passwordCredentials.passwordHash,
      roleCode: roles.code,
      userId: users.id,
      userStatus: users.status,
    })
    .from(userEmails)
    .innerJoin(users, eq(users.id, userEmails.userId))
    .innerJoin(
      passwordCredentials,
      eq(passwordCredentials.emailId, userEmails.id),
    )
    .innerJoin(userRoleBindings, eq(userRoleBindings.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoleBindings.roleId))
    .innerJoin(applications, eq(applications.id, roles.applicationId))
    .innerJoin(
      applicationAuthMethods,
      eq(applicationAuthMethods.applicationId, applications.id),
    )
    .where(
      and(
        eq(userEmails.normalizedEmail, normalizedEmail),
        eq(userRoleBindings.status, "active"),
        eq(roles.code, "admin_owner"),
        eq(applications.code, "admin"),
        eq(applications.status, "active"),
        eq(applicationAuthMethods.provider, "password"),
        eq(applicationAuthMethods.enabled, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findActiveAdminRoles(
  database: D1Database | undefined,
  userId: string,
) {
  const db = createD1Client(database);

  return db
    .select({ code: roles.code })
    .from(userRoleBindings)
    .innerJoin(roles, eq(roles.id, userRoleBindings.roleId))
    .innerJoin(applications, eq(applications.id, roles.applicationId))
    .where(
      and(
        eq(userRoleBindings.userId, userId),
        eq(userRoleBindings.status, "active"),
        eq(applications.code, "admin"),
        eq(applications.status, "active"),
      ),
    );
}

export async function findSessionById(
  database: D1Database | undefined,
  sessionId: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select()
    .from(authSessions)
    .where(eq(authSessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function findRefreshTokenContext(
  database: D1Database | undefined,
  jtiHash: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      applicationCode: applications.code,
      applicationId: applications.id,
      applicationStatus: applications.status,
      refreshToken: refreshTokens,
      session: authSessions,
      userId: users.id,
      userStatus: users.status,
    })
    .from(refreshTokens)
    .innerJoin(authSessions, eq(authSessions.id, refreshTokens.sessionId))
    .innerJoin(users, eq(users.id, authSessions.userId))
    .innerJoin(applications, eq(applications.id, authSessions.applicationId))
    .where(eq(refreshTokens.jtiHash, jtiHash))
    .limit(1);

  return rows[0] ?? null;
}

export async function createSessionWithRefreshToken(
  database: D1Database | undefined,
  input: CreateSessionInput,
): Promise<void> {
  if (
    input.refreshToken.sessionId !== input.session.id ||
    input.refreshToken.parentTokenId != null
  ) {
    throw new Error("session 与初始 refresh token 参数不一致");
  }

  const db = requireD1Database(database);
  const session = input.session;
  const token = input.refreshToken;

  await db.batch([
    db
      .prepare(
        `INSERT INTO auth_sessions (
          id, user_id, application_id, session_type, user_agent, ip,
          last_seen_at_ms, created_at_ms, expires_at_ms, revoked_at_ms, revoke_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        session.id,
        session.userId,
        session.applicationId,
        session.sessionType,
        session.userAgent ?? null,
        session.ip ?? null,
        session.lastSeenAtMs,
        session.createdAtMs,
        session.expiresAtMs,
        session.revokedAtMs ?? null,
        session.revokeReason ?? null,
      ),
    db
      .prepare(
        `INSERT INTO refresh_tokens (
          id, session_id, jti_hash, parent_token_id, issued_at_ms,
          expires_at_ms, used_at_ms, revoked_at_ms, replaced_by_token_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        token.id,
        token.sessionId,
        token.jtiHash,
        token.parentTokenId ?? null,
        token.issuedAtMs,
        token.expiresAtMs,
        token.usedAtMs ?? null,
        token.revokedAtMs ?? null,
        token.replacedByTokenId ?? null,
      ),
  ]);
}

export async function rotateRefreshToken(
  database: D1Database | undefined,
  input: RotateRefreshTokenInput,
): Promise<RotateRefreshTokenResult> {
  if (
    input.newToken.parentTokenId !== input.currentTokenId ||
    input.newToken.sessionId !== input.sessionId ||
    input.newToken.issuedAtMs !== input.rotatedAtMs
  ) {
    throw new Error("refresh rotation 参数不一致");
  }

  const db = requireD1Database(database);
  const token = input.newToken;

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO refresh_tokens (
            id, session_id, jti_hash, parent_token_id, issued_at_ms,
            expires_at_ms, used_at_ms, revoked_at_ms, replaced_by_token_id
          ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
        )
        .bind(
          token.id,
          token.sessionId,
          token.jtiHash,
          token.parentTokenId,
          token.issuedAtMs,
          token.expiresAtMs,
        ),
      db
        .prepare(
          `UPDATE refresh_tokens
           SET used_at_ms = ?, replaced_by_token_id = ?
           WHERE id = ?`,
        )
        .bind(input.rotatedAtMs, token.id, input.currentTokenId),
      db
        .prepare(
          `UPDATE auth_sessions
           SET last_seen_at_ms = ?
           WHERE id = ?`,
        )
        .bind(input.rotatedAtMs, input.sessionId),
    ]);
  } catch (error) {
    if (await isRejectedRotation(db, input)) {
      return { status: "rejected" };
    }

    throw error;
  }

  return { status: "rotated" };
}

export async function revokeSession(
  database: D1Database | undefined,
  sessionId: string,
  revokedAtMs: number,
  reason: string,
): Promise<void> {
  const db = requireD1Database(database);

  await db.batch([
    db
      .prepare(
        `UPDATE auth_sessions
         SET revoked_at_ms = COALESCE(revoked_at_ms, ?),
             revoke_reason = COALESCE(revoke_reason, ?)
         WHERE id = ?`,
      )
      .bind(revokedAtMs, reason, sessionId),
    db
      .prepare(
        `UPDATE refresh_tokens
         SET revoked_at_ms = COALESCE(revoked_at_ms, ?)
         WHERE session_id = ? AND expires_at_ms > ?`,
      )
      .bind(revokedAtMs, sessionId, revokedAtMs),
  ]);
}

function requireD1Database(database: D1Database | undefined): D1Database {
  if (!database) {
    throw new Error("D1 binding DB 未配置");
  }

  return database;
}

async function isRejectedRotation(
  database: D1Database,
  input: RotateRefreshTokenInput,
): Promise<boolean> {
  const db = createD1Client(database);
  const [currentToken] = await db
    .select({
      expiresAtMs: refreshTokens.expiresAtMs,
      replacedByTokenId: refreshTokens.replacedByTokenId,
      revokedAtMs: refreshTokens.revokedAtMs,
      usedAtMs: refreshTokens.usedAtMs,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.id, input.currentTokenId))
    .limit(1);

  if (
    !currentToken ||
    currentToken.usedAtMs != null ||
    currentToken.revokedAtMs != null ||
    currentToken.replacedByTokenId != null ||
    currentToken.expiresAtMs <= input.rotatedAtMs
  ) {
    return true;
  }

  const [session] = await db
    .select({
      expiresAtMs: authSessions.expiresAtMs,
      revokedAtMs: authSessions.revokedAtMs,
    })
    .from(authSessions)
    .where(eq(authSessions.id, input.sessionId))
    .limit(1);

  if (
    !session ||
    session.revokedAtMs != null ||
    session.expiresAtMs <= input.rotatedAtMs
  ) {
    return true;
  }

  const [existingChild] = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(eq(refreshTokens.parentTokenId, input.currentTokenId))
    .limit(1);

  return existingChild != null;
}
