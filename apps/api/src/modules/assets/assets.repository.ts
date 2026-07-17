import { createD1Client } from "@/infra/db/d1";

import { defaultAvatarVersions } from "./assets.schema";
import type { NewDefaultAvatarVersionRecord } from "./assets.schema";

export async function insertDefaultAvatarVersion(
  database: D1Database | undefined,
  record: NewDefaultAvatarVersionRecord,
): Promise<void> {
  const db = createD1Client(database);

  await db.insert(defaultAvatarVersions).values(record);
}
