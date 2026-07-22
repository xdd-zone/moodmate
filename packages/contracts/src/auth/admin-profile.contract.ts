import { z } from "zod";

import {
  DEFAULT_AVATAR_MAX_BYTES,
  DefaultAvatarContentTypeSchema,
  DefaultAvatarKeySchema,
} from "../assets/default-avatar.contract";
import { AdminRoleSchema } from "./admin-auth.contract";

export const PERSONAL_AVATAR_MAX_BYTES = DEFAULT_AVATAR_MAX_BYTES;

export const PersonalAvatarContentTypeSchema = DefaultAvatarContentTypeSchema;

export const PersonalAvatarKeySchema = z
  .string()
  .trim()
  .regex(
    /^avatars\/users\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/u,
    "个人头像 key 格式无效",
  );

export const AdminProfileAvatarSchema = z.discriminatedUnion("source", [
  z.object({
    key: PersonalAvatarKeySchema,
    source: z.literal("personal"),
  }),
  z.object({
    key: DefaultAvatarKeySchema,
    source: z.literal("default"),
  }),
]);

export const AdminProfileStatusSchema = z.enum([
  "active",
  "suspended",
  "deleted",
]);

export const AdminProfileSchema = z.object({
  avatar: AdminProfileAvatarSchema.nullable(),
  createdAtMs: z.number().int().positive(),
  displayName: z.string().min(1),
  email: z.email(),
  id: z.uuid(),
  lastLoginAtMs: z.number().int().positive().nullable(),
  roles: z.array(AdminRoleSchema).min(1),
  status: AdminProfileStatusSchema,
  updatedAtMs: z.number().int().positive(),
});

export const AdminProfileAvatarReadQuerySchema = z.object({
  key: z.union([PersonalAvatarKeySchema, DefaultAvatarKeySchema]),
});

export const AdminProfileAvatarUploadResponseSchema = z.object({
  key: PersonalAvatarKeySchema,
  updatedAtMs: z.number().int().positive(),
});

export type AdminProfile = z.infer<typeof AdminProfileSchema>;
export type AdminProfileAvatar = z.infer<typeof AdminProfileAvatarSchema>;
export type AdminProfileAvatarReadQuery = z.infer<
  typeof AdminProfileAvatarReadQuerySchema
>;
export type AdminProfileAvatarUploadResponse = z.infer<
  typeof AdminProfileAvatarUploadResponseSchema
>;
