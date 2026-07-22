import { and, eq, isNull, sql } from "drizzle-orm";

import { createD1Client } from "@/infra/db/d1";

import {
  applicationAuthMethods,
  applications,
  authSessions,
  oauthAccounts,
  oauthLoginTickets,
  passwordCredentials,
  refreshTokens,
  roles,
  userEmails,
  userRoleBindings,
  users,
} from "./auth.schema";
import type {
  AuthSessionRecord,
  NewAuthSessionRecord,
  NewRefreshTokenRecord,
} from "./auth.schema";

type AuthApplication = AuthSessionRecord["sessionType"];

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

export async function findPasswordLoginContext(
  database: D1Database | undefined,
  normalizedEmail: string,
  application: AuthApplication,
  requiredRole: string,
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
        eq(roles.status, "active"),
        eq(roles.code, requiredRole),
        eq(applications.code, application),
        eq(applications.status, "active"),
        eq(applicationAuthMethods.provider, "password"),
        eq(applicationAuthMethods.enabled, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findActiveRoles(
  database: D1Database | undefined,
  userId: string,
  application: AuthApplication,
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
        eq(roles.status, "active"),
        eq(applications.code, application),
        eq(applications.status, "active"),
      ),
    );
}

export async function findWebGithubLoginSetup(
  database: D1Database | undefined,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      applicationId: applications.id,
      roleId: roles.id,
    })
    .from(applications)
    .innerJoin(
      applicationAuthMethods,
      eq(applicationAuthMethods.applicationId, applications.id),
    )
    .innerJoin(roles, eq(roles.applicationId, applications.id))
    .where(
      and(
        eq(applications.code, "web"),
        eq(applications.status, "active"),
        eq(applicationAuthMethods.provider, "github"),
        eq(applicationAuthMethods.enabled, true),
        eq(roles.code, "web_user"),
        eq(roles.status, "active"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findWebUserByGithubAccount(
  database: D1Database | undefined,
  providerUserId: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      userId: users.id,
      userStatus: users.status,
    })
    .from(oauthAccounts)
    .innerJoin(users, eq(users.id, oauthAccounts.userId))
    .where(
      and(
        eq(oauthAccounts.provider, "github"),
        eq(oauthAccounts.providerUserId, providerUserId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findAuthUserByNormalizedEmail(
  database: D1Database | undefined,
  normalizedEmail: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      emailId: userEmails.id,
      userId: users.id,
      userStatus: users.status,
    })
    .from(userEmails)
    .innerJoin(users, eq(users.id, userEmails.userId))
    .where(eq(userEmails.normalizedEmail, normalizedEmail))
    .limit(1);

  return rows[0] ?? null;
}

export async function findWebOauthLoginContext(
  database: D1Database | undefined,
  userId: string,
  applicationId: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      applicationCode: applications.code,
      applicationStatus: applications.status,
      displayName: users.displayName,
      email: userEmails.email,
      userStatus: users.status,
    })
    .from(users)
    .innerJoin(
      userEmails,
      and(eq(userEmails.userId, users.id), eq(userEmails.isPrimary, true)),
    )
    .innerJoin(applications, eq(applications.id, applicationId))
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function createGithubWebUser(input: {
  database: D1Database | undefined;
  displayName: string;
  email: string;
  emailId: string;
  normalizedEmail: string;
  nowMs: number;
  oauthAccountId: string;
  providerLogin: string | null;
  providerUserId: string;
  roleBindingId: string;
  userId: string;
  webRoleId: string;
}): Promise<void> {
  const db = createD1Client(input.database);

  await db.batch([
    db.insert(users).values({
      createdAtMs: input.nowMs,
      displayName: input.displayName,
      id: input.userId,
      lastLoginAtMs: null,
      status: "active",
      updatedAtMs: input.nowMs,
    }),
    db.insert(userEmails).values({
      createdAtMs: input.nowMs,
      email: input.email,
      id: input.emailId,
      isPrimary: true,
      isVerified: true,
      normalizedEmail: input.normalizedEmail,
      source: "oauth",
      updatedAtMs: input.nowMs,
      userId: input.userId,
      verifiedAtMs: input.nowMs,
    }),
    db.insert(oauthAccounts).values({
      createdAtMs: input.nowMs,
      emailId: input.emailId,
      id: input.oauthAccountId,
      provider: "github",
      providerLogin: input.providerLogin,
      providerUserId: input.providerUserId,
      updatedAtMs: input.nowMs,
      userId: input.userId,
    }),
    db.insert(userRoleBindings).values({
      createdAtMs: input.nowMs,
      grantedAtMs: input.nowMs,
      id: input.roleBindingId,
      revokedAtMs: null,
      roleId: input.webRoleId,
      status: "active",
      updatedAtMs: input.nowMs,
      userId: input.userId,
    }),
  ]);
}

export async function linkGithubAccountToUser(input: {
  database: D1Database | undefined;
  emailId: string;
  nowMs: number;
  oauthAccountId: string;
  providerLogin: string | null;
  providerUserId: string;
  userId: string;
}): Promise<void> {
  const db = createD1Client(input.database);

  await db.insert(oauthAccounts).values({
    createdAtMs: input.nowMs,
    emailId: input.emailId,
    id: input.oauthAccountId,
    provider: "github",
    providerLogin: input.providerLogin,
    providerUserId: input.providerUserId,
    updatedAtMs: input.nowMs,
    userId: input.userId,
  });
}

export async function updateGithubAccountLogin(input: {
  database: D1Database | undefined;
  nowMs: number;
  providerLogin: string | null;
  providerUserId: string;
}): Promise<void> {
  const db = createD1Client(input.database);

  await db
    .update(oauthAccounts)
    .set({
      providerLogin: input.providerLogin,
      updatedAtMs: input.nowMs,
    })
    .where(
      and(
        eq(oauthAccounts.provider, "github"),
        eq(oauthAccounts.providerUserId, input.providerUserId),
      ),
    );
}

export async function ensureUserHasRole(input: {
  bindingId: string;
  database: D1Database | undefined;
  nowMs: number;
  roleId: string;
  userId: string;
}): Promise<void> {
  const db = createD1Client(input.database);

  await db
    .insert(userRoleBindings)
    .values({
      createdAtMs: input.nowMs,
      grantedAtMs: input.nowMs,
      id: input.bindingId,
      revokedAtMs: null,
      roleId: input.roleId,
      status: "active",
      updatedAtMs: input.nowMs,
      userId: input.userId,
    })
    .onConflictDoUpdate({
      set: {
        grantedAtMs: input.nowMs,
        revokedAtMs: null,
        status: "active",
        updatedAtMs: input.nowMs,
      },
      target: [userRoleBindings.userId, userRoleBindings.roleId],
    });
}

export async function insertOauthLoginTicket(input: {
  applicationId: string;
  createdAtMs: number;
  database: D1Database | undefined;
  expiresAtMs: number;
  id: string;
  ticketHash: string;
  userId: string;
}): Promise<void> {
  const db = createD1Client(input.database);

  await db.insert(oauthLoginTickets).values({
    applicationId: input.applicationId,
    createdAtMs: input.createdAtMs,
    expiresAtMs: input.expiresAtMs,
    id: input.id,
    provider: "github",
    ticketHash: input.ticketHash,
    usedAtMs: null,
    userId: input.userId,
  });
}

export async function consumeOauthLoginTicket(input: {
  database: D1Database | undefined;
  nowMs: number;
  ticketHash: string;
}) {
  const db = createD1Client(input.database);
  const rows = await db
    .update(oauthLoginTickets)
    .set({ usedAtMs: input.nowMs })
    .where(
      and(
        eq(oauthLoginTickets.ticketHash, input.ticketHash),
        eq(oauthLoginTickets.provider, "github"),
        isNull(oauthLoginTickets.usedAtMs),
        sql`${oauthLoginTickets.expiresAtMs} > ${input.nowMs}`,
      ),
    )
    .returning({
      applicationId: oauthLoginTickets.applicationId,
      userId: oauthLoginTickets.userId,
    });

  return rows[0] ?? null;
}

export async function recordSuccessfulOauthLogin(
  database: D1Database | undefined,
  userId: string,
  loggedInAtMs: number,
): Promise<void> {
  const db = createD1Client(database);

  await db
    .update(users)
    .set({ lastLoginAtMs: loggedInAtMs, updatedAtMs: loggedInAtMs })
    .where(eq(users.id, userId));
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

export async function findSessionContext(
  database: D1Database | undefined,
  sessionId: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      applicationCode: applications.code,
      applicationStatus: applications.status,
      displayName: users.displayName,
      email: userEmails.email,
      session: authSessions,
      userStatus: users.status,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .innerJoin(
      userEmails,
      and(eq(userEmails.userId, users.id), eq(userEmails.isPrimary, true)),
    )
    .innerJoin(applications, eq(applications.id, authSessions.applicationId))
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

export async function recordFailedPasswordAttempt(
  database: D1Database | undefined,
  credentialId: string,
  failedAtMs: number,
  lockThreshold: number,
  lockDurationMs: number,
): Promise<void> {
  const db = requireD1Database(database);

  await db
    .prepare(
      `UPDATE password_credentials
       SET failed_attempts = failed_attempts + 1,
           locked_until_ms = CASE
             WHEN failed_attempts + 1 >= ? THEN ?
             ELSE locked_until_ms
           END,
           updated_at_ms = ?
       WHERE id = ?`,
    )
    .bind(lockThreshold, failedAtMs + lockDurationMs, failedAtMs, credentialId)
    .run();
}

export async function recordSuccessfulPasswordLogin(
  database: D1Database | undefined,
  credentialId: string,
  userId: string,
  loggedInAtMs: number,
): Promise<void> {
  const db = requireD1Database(database);

  await db.batch([
    db
      .prepare(
        `UPDATE password_credentials
         SET failed_attempts = 0,
             locked_until_ms = NULL,
             updated_at_ms = ?
         WHERE id = ?`,
      )
      .bind(loggedInAtMs, credentialId),
    db
      .prepare(
        `UPDATE users
         SET last_login_at_ms = ?, updated_at_ms = ?
         WHERE id = ?`,
      )
      .bind(loggedInAtMs, loggedInAtMs, userId),
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
