import { and, eq } from "drizzle-orm";

import { createD1Client } from "@/infra/db/d1";
import {
  applications,
  roles,
  userEmails,
  userRoleBindings,
  users,
} from "@/modules/auth/auth.schema";

import { userAvatarAssets } from "./profile.schema";
import type { NewUserAvatarAssetRecord } from "./profile.schema";

export async function findAdminProfile(
  database: D1Database | undefined,
  userId: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      createdAtMs: users.createdAtMs,
      displayName: users.displayName,
      email: userEmails.email,
      id: users.id,
      lastLoginAtMs: users.lastLoginAtMs,
      roleCode: roles.code,
      status: users.status,
      updatedAtMs: users.updatedAtMs,
    })
    .from(users)
    .innerJoin(
      userEmails,
      and(eq(userEmails.userId, users.id), eq(userEmails.isPrimary, true)),
    )
    .innerJoin(userRoleBindings, eq(userRoleBindings.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoleBindings.roleId))
    .innerJoin(applications, eq(applications.id, roles.applicationId))
    .where(
      and(
        eq(users.id, userId),
        eq(userRoleBindings.status, "active"),
        eq(roles.status, "active"),
        eq(applications.code, "admin"),
        eq(applications.status, "active"),
      ),
    );

  const first = rows[0];
  if (!first) return null;

  return {
    createdAtMs: first.createdAtMs,
    displayName: first.displayName,
    email: first.email,
    id: first.id,
    lastLoginAtMs: first.lastLoginAtMs,
    roles: rows.map((row) => row.roleCode),
    status: first.status,
    updatedAtMs: first.updatedAtMs,
  };
}

export async function findUserAvatarAsset(
  database: D1Database | undefined,
  userId: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select()
    .from(userAvatarAssets)
    .where(eq(userAvatarAssets.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertUserAvatarAsset(
  database: D1Database | undefined,
  record: NewUserAvatarAssetRecord,
): Promise<void> {
  const db = createD1Client(database);

  await db
    .insert(userAvatarAssets)
    .values(record)
    .onConflictDoUpdate({
      set: {
        avatarKey: record.avatarKey,
        contentType: record.contentType,
        createdAtMs: record.createdAtMs,
        fileName: record.fileName,
        id: record.id,
        sizeBytes: record.sizeBytes,
      },
      target: userAvatarAssets.userId,
    });
}
