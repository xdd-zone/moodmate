import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { users } from "@/modules/auth/auth.schema";

export const userAvatarAssets = sqliteTable(
  "user_avatar_assets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    avatarKey: text("avatar_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type", {
      enum: ["image/jpeg", "image/png", "image/webp"],
    }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
  },
  (table) => [
    unique("user_avatar_assets_user_id_unique").on(table.userId),
    unique("user_avatar_assets_avatar_key_unique").on(table.avatarKey),
    index("user_avatar_assets_created_at_ms_idx").on(table.createdAtMs),
    check(
      "user_avatar_assets_content_type_check",
      sql`${table.contentType} IN ('image/jpeg', 'image/png', 'image/webp')`,
    ),
    check(
      "user_avatar_assets_size_bytes_check",
      sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 2097152`,
    ),
    check(
      "user_avatar_assets_created_at_ms_check",
      sql`${table.createdAtMs} > 0`,
    ),
  ],
);

export type NewUserAvatarAssetRecord = typeof userAvatarAssets.$inferInsert;
export type UserAvatarAssetRecord = typeof userAvatarAssets.$inferSelect;
