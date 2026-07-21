import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    status: text("status", {
      enum: ["active", "suspended", "deleted"],
    }).notNull(),
    displayName: text("display_name").notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
    lastLoginAtMs: integer("last_login_at_ms"),
  },
  (table) => [
    check(
      "users_status_check",
      sql`${table.status} IN ('active', 'suspended', 'deleted')`,
    ),
    check(
      "users_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const userEmails = sqliteTable(
  "user_emails",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    isVerified: integer("is_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    verifiedAtMs: integer("verified_at_ms"),
    source: text("source", { enum: ["password", "oauth", "system"] }).notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("user_emails_user_normalized_unique").on(
      table.userId,
      table.normalizedEmail,
    ),
    unique("user_emails_normalized_unique").on(table.normalizedEmail),
    uniqueIndex("user_emails_primary_user_unique")
      .on(table.userId)
      .where(sql`${table.isPrimary} = 1`),
    check("user_emails_primary_check", sql`${table.isPrimary} IN (0, 1)`),
    check("user_emails_verified_check", sql`${table.isVerified} IN (0, 1)`),
    check(
      "user_emails_verified_at_check",
      sql`${table.isVerified} = 0 OR ${table.verifiedAtMs} IS NOT NULL`,
    ),
    check(
      "user_emails_source_check",
      sql`${table.source} IN ('password', 'oauth', 'system')`,
    ),
    check(
      "user_emails_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const passwordCredentials = sqliteTable(
  "password_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailId: text("email_id")
      .notNull()
      .references(() => userEmails.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    passwordAlgo: text("password_algo", { enum: ["pbkdf2-sha256"] }).notNull(),
    passwordUpdatedAtMs: integer("password_updated_at_ms").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntilMs: integer("locked_until_ms"),
    mustResetPassword: integer("must_reset_password", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("password_credentials_user_unique").on(table.userId),
    unique("password_credentials_email_unique").on(table.emailId),
    check(
      "password_credentials_algo_check",
      sql`${table.passwordAlgo} = 'pbkdf2-sha256'`,
    ),
    check(
      "password_credentials_failed_attempts_check",
      sql`${table.failedAttempts} >= 0`,
    ),
    check(
      "password_credentials_reset_check",
      sql`${table.mustResetPassword} IN (0, 1)`,
    ),
    check(
      "password_credentials_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: ["active", "disabled"] }).notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("applications_code_unique").on(table.code),
    check(
      "applications_status_check",
      sql`${table.status} IN ('active', 'disabled')`,
    ),
    check(
      "applications_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const applicationAuthMethods = sqliteTable(
  "application_auth_methods",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    provider: text("provider", {
      enum: ["password", "github", "google"],
    }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("application_auth_methods_unique").on(
      table.applicationId,
      table.provider,
    ),
    check(
      "application_auth_methods_provider_check",
      sql`${table.provider} IN ('password', 'github', 'google')`,
    ),
    check(
      "application_auth_methods_enabled_check",
      sql`${table.enabled} IN (0, 1)`,
    ),
    check(
      "application_auth_methods_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status", {
      enum: ["active", "disabled", "deleted"],
    })
      .notNull()
      .default("active"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
    disabledAtMs: integer("disabled_at_ms"),
    deletedAtMs: integer("deleted_at_ms"),
  },
  (table) => [
    unique("roles_application_code_unique").on(table.applicationId, table.code),
    index("roles_application_status_idx").on(table.applicationId, table.status),
    check(
      "roles_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
    check(
      "roles_status_check",
      sql`${table.status} IN ('active', 'disabled', 'deleted')`,
    ),
  ],
);

export const userRoleBindings = sqliteTable(
  "user_role_bindings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "revoked"] }).notNull(),
    grantedAtMs: integer("granted_at_ms").notNull(),
    revokedAtMs: integer("revoked_at_ms"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    unique("user_role_bindings_unique").on(table.userId, table.roleId),
    index("user_role_bindings_user_status_idx").on(table.userId, table.status),
    index("user_role_bindings_role_status_idx").on(table.roleId, table.status),
    check(
      "user_role_bindings_status_check",
      sql`${table.status} IN ('active', 'revoked')`,
    ),
    check(
      "user_role_bindings_revoked_at_check",
      sql`${table.status} = 'active' OR ${table.revokedAtMs} IS NOT NULL`,
    ),
    check(
      "user_role_bindings_timestamps_check",
      sql`${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    sessionType: text("session_type", { enum: ["admin", "web"] }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    lastSeenAtMs: integer("last_seen_at_ms").notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    expiresAtMs: integer("expires_at_ms").notNull(),
    revokedAtMs: integer("revoked_at_ms"),
    revokeReason: text("revoke_reason"),
  },
  (table) => [
    index("auth_sessions_user_app_status_idx").on(
      table.userId,
      table.applicationId,
      table.revokedAtMs,
      table.expiresAtMs,
    ),
    check(
      "auth_sessions_type_check",
      sql`${table.sessionType} IN ('admin', 'web')`,
    ),
    check(
      "auth_sessions_expiry_check",
      sql`${table.expiresAtMs} > ${table.createdAtMs}`,
    ),
    check(
      "auth_sessions_last_seen_check",
      sql`${table.lastSeenAtMs} >= ${table.createdAtMs}`,
    ),
    check(
      "auth_sessions_revoke_reason_check",
      sql`${table.revokedAtMs} IS NULL OR ${table.revokeReason} IS NOT NULL`,
    ),
  ],
);

export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => authSessions.id, { onDelete: "cascade" }),
    jtiHash: text("jti_hash").notNull(),
    parentTokenId: text("parent_token_id").references(
      (): AnySQLiteColumn => refreshTokens.id,
      { onDelete: "set null" },
    ),
    issuedAtMs: integer("issued_at_ms").notNull(),
    expiresAtMs: integer("expires_at_ms").notNull(),
    usedAtMs: integer("used_at_ms"),
    revokedAtMs: integer("revoked_at_ms"),
    replacedByTokenId: text("replaced_by_token_id").references(
      (): AnySQLiteColumn => refreshTokens.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    unique("refresh_tokens_jti_hash_unique").on(table.jtiHash),
    uniqueIndex("refresh_tokens_parent_unique")
      .on(table.parentTokenId)
      .where(sql`${table.parentTokenId} IS NOT NULL`),
    index("refresh_tokens_session_status_idx").on(
      table.sessionId,
      table.revokedAtMs,
      table.expiresAtMs,
    ),
    check(
      "refresh_tokens_expiry_check",
      sql`${table.expiresAtMs} > ${table.issuedAtMs}`,
    ),
    check(
      "refresh_tokens_not_self_parent_check",
      sql`${table.parentTokenId} IS NULL OR ${table.parentTokenId} != ${table.id}`,
    ),
    check(
      "refresh_tokens_not_self_replacement_check",
      sql`${table.replacedByTokenId} IS NULL OR ${table.replacedByTokenId} != ${table.id}`,
    ),
  ],
);

export type AuthSessionRecord = typeof authSessions.$inferSelect;
export type NewAuthSessionRecord = typeof authSessions.$inferInsert;
export type NewRefreshTokenRecord = typeof refreshTokens.$inferInsert;
export type RefreshTokenRecord = typeof refreshTokens.$inferSelect;
