import { z } from "zod";

export const DefaultAvatarKeySchema = z
  .string()
  .trim()
  .regex(
    /^avatars\/default\/\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/u,
    "头像 key 格式无效",
  );

export const DefaultAvatarReadQuerySchema = z.object({
  key: DefaultAvatarKeySchema,
});

export type DefaultAvatarReadQuery = z.infer<
  typeof DefaultAvatarReadQuerySchema
>;

export const AdminDefaultAvatarUploadResponseSchema = z.object({
  key: DefaultAvatarKeySchema,
  updatedAtMs: z.number().int().positive(),
});

export type AdminDefaultAvatarUploadResponse = z.infer<
  typeof AdminDefaultAvatarUploadResponseSchema
>;
