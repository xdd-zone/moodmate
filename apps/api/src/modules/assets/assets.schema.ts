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

import { users } from "@/modules/auth/auth.schema";

export const defaultAvatarVersions = sqliteTable(
  "default_avatar_versions",
  {
    id: text("id").primaryKey(),
    avatarKey: text("avatar_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type", {
      enum: ["image/jpeg", "image/png", "image/webp"],
    }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAtMs: integer("created_at_ms").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    unique("default_avatar_versions_avatar_key_unique").on(table.avatarKey),
    uniqueIndex("default_avatar_versions_current_unique")
      .on(table.isCurrent)
      .where(sql`${table.isCurrent} = 1`),
    index("default_avatar_versions_created_at_ms_idx").on(table.createdAtMs),
    check(
      "default_avatar_versions_content_type_check",
      sql`${table.contentType} IN ('image/jpeg', 'image/png', 'image/webp')`,
    ),
    check(
      "default_avatar_versions_size_bytes_check",
      sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 2097152`,
    ),
    check(
      "default_avatar_versions_created_at_ms_check",
      sql`${table.createdAtMs} > 0`,
    ),
  ],
);

export type NewDefaultAvatarVersionRecord =
  typeof defaultAvatarVersions.$inferInsert;
export type DefaultAvatarVersionRecord =
  typeof defaultAvatarVersions.$inferSelect;
