import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";
import {
  applications,
  passwordCredentials,
  roles,
  userEmails,
  userRoleBindings,
  users,
} from "@/modules/auth/auth.schema";

export async function findUserList(
  database: D1Database | undefined,
  input: { limit: number; offset: number },
) {
  const db = createD1Client(database);
  const totalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .where(ne(users.status, "deleted"));
  const total = Number(totalRows[0]?.total ?? 0);
  const items = await db
    .select({
      createdAtMs: users.createdAtMs,
      displayName: users.displayName,
      email: userEmails.email,
      id: users.id,
      lastLoginAtMs: users.lastLoginAtMs,
      status: users.status,
    })
    .from(users)
    .innerJoin(
      userEmails,
      and(eq(userEmails.userId, users.id), eq(userEmails.isPrimary, true)),
    )
    .where(ne(users.status, "deleted"))
    .orderBy(desc(users.createdAtMs), desc(users.id))
    .limit(input.limit)
    .offset(input.offset);

  if (items.length === 0) {
    return { items, roleRows: [], total };
  }

  const roleRows = await db
    .select({
      applicationCode: applications.code,
      code: roles.code,
      id: roles.id,
      name: roles.name,
      userId: userRoleBindings.userId,
    })
    .from(userRoleBindings)
    .innerJoin(roles, eq(roles.id, userRoleBindings.roleId))
    .innerJoin(applications, eq(applications.id, roles.applicationId))
    .where(
      and(
        inArray(
          userRoleBindings.userId,
          items.map((item) => item.id),
        ),
        eq(userRoleBindings.status, "active"),
        eq(roles.status, "active"),
        eq(applications.status, "active"),
      ),
    );

  return { items, roleRows, total };
}

export type UserListRow = Awaited<
  ReturnType<typeof findUserList>
>["items"][number];
export type UserRoleRow = Awaited<
  ReturnType<typeof findUserList>
>["roleRows"][number];

export async function findUserByNormalizedEmail(
  database: D1Database | undefined,
  normalizedEmail: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({ id: userEmails.id })
    .from(userEmails)
    .where(eq(userEmails.normalizedEmail, normalizedEmail))
    .limit(1);

  return rows[0] ?? null;
}

export async function findAssignableRoleById(
  database: D1Database | undefined,
  roleId: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      applicationCode: applications.code,
      code: roles.code,
      id: roles.id,
      name: roles.name,
    })
    .from(roles)
    .innerJoin(applications, eq(applications.id, roles.applicationId))
    .where(
      and(
        eq(roles.id, roleId),
        eq(roles.status, "active"),
        eq(applications.status, "active"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function insertUserWithPassword(input: {
  database: D1Database | undefined;
  displayName: string;
  email: string;
  normalizedEmail: string;
  nowMs: number;
  passwordHash: string;
  roleId: string;
}) {
  const db = createD1Client(input.database);
  const credentialId = uuidv7();
  const emailId = uuidv7();
  const roleBindingId = uuidv7();
  const userId = uuidv7();

  await db.batch([
    db.insert(users).values({
      createdAtMs: input.nowMs,
      displayName: input.displayName,
      id: userId,
      lastLoginAtMs: null,
      status: "active",
      updatedAtMs: input.nowMs,
    }),
    db.insert(userEmails).values({
      createdAtMs: input.nowMs,
      email: input.email,
      id: emailId,
      isPrimary: true,
      isVerified: true,
      normalizedEmail: input.normalizedEmail,
      source: "password",
      updatedAtMs: input.nowMs,
      userId,
      verifiedAtMs: input.nowMs,
    }),
    db.insert(passwordCredentials).values({
      createdAtMs: input.nowMs,
      emailId,
      failedAttempts: 0,
      id: credentialId,
      lockedUntilMs: null,
      mustResetPassword: false,
      passwordAlgo: "pbkdf2-sha256",
      passwordHash: input.passwordHash,
      passwordUpdatedAtMs: input.nowMs,
      updatedAtMs: input.nowMs,
      userId,
    }),
    db.insert(userRoleBindings).values({
      createdAtMs: input.nowMs,
      grantedAtMs: input.nowMs,
      id: roleBindingId,
      revokedAtMs: null,
      roleId: input.roleId,
      status: "active",
      updatedAtMs: input.nowMs,
      userId,
    }),
  ]);

  return userId;
}
