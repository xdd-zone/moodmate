import { desc, eq } from "drizzle-orm";

import { createD1Client } from "@/infra/db/d1";

import { defaultAvatarVersions } from "./assets.schema";
import type {
  DefaultAvatarVersionRecord,
  NewDefaultAvatarVersionRecord,
} from "./assets.schema";

export async function insertCurrentDefaultAvatarVersion(
  database: D1Database | undefined,
  record: NewDefaultAvatarVersionRecord,
): Promise<void> {
  const db = createD1Client(database);

  await db.batch([
    db
      .update(defaultAvatarVersions)
      .set({ isCurrent: false })
      .where(eq(defaultAvatarVersions.isCurrent, true)),
    db.insert(defaultAvatarVersions).values({ ...record, isCurrent: true }),
  ]);
}

export async function findCurrentDefaultAvatarVersion(
  database: D1Database | undefined,
): Promise<DefaultAvatarVersionRecord | null> {
  const db = createD1Client(database);
  const rows = await db
    .select()
    .from(defaultAvatarVersions)
    .where(eq(defaultAvatarVersions.isCurrent, true))
    .limit(1);

  return rows[0] ?? null;
}

export async function listDefaultAvatarVersions(
  database: D1Database | undefined,
): Promise<DefaultAvatarVersionRecord[]> {
  const db = createD1Client(database);

  return db
    .select()
    .from(defaultAvatarVersions)
    .orderBy(
      desc(defaultAvatarVersions.createdAtMs),
      desc(defaultAvatarVersions.id),
    );
}

export async function setCurrentDefaultAvatarVersion(
  database: D1Database | undefined,
  versionId: string,
): Promise<DefaultAvatarVersionRecord | null> {
  const db = createD1Client(database);
  const rows = await db
    .select()
    .from(defaultAvatarVersions)
    .where(eq(defaultAvatarVersions.id, versionId))
    .limit(1);
  const version = rows[0];

  if (!version) {
    return null;
  }

  await db.batch([
    db
      .update(defaultAvatarVersions)
      .set({ isCurrent: false })
      .where(eq(defaultAvatarVersions.isCurrent, true)),
    db
      .update(defaultAvatarVersions)
      .set({ isCurrent: true })
      .where(eq(defaultAvatarVersions.id, versionId)),
  ]);

  return { ...version, isCurrent: true };
}
