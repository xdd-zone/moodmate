import { z } from "zod";

export const DEFAULT_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const DefaultAvatarContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

export const AdminDefaultAvatarVersionSchema = z.object({
  contentType: DefaultAvatarContentTypeSchema,
  createdAtMs: z.number().int().positive(),
  fileName: z.string().min(1),
  id: z.uuid(),
  isCurrent: z.boolean(),
  key: DefaultAvatarKeySchema,
  sizeBytes: z.number().int().positive().max(DEFAULT_AVATAR_MAX_BYTES),
});

export type AdminDefaultAvatarVersion = z.infer<
  typeof AdminDefaultAvatarVersionSchema
>;

export const AdminDefaultAvatarCurrentResponseSchema = z.object({
  version: AdminDefaultAvatarVersionSchema.nullable(),
});

export type AdminDefaultAvatarCurrentResponse = z.infer<
  typeof AdminDefaultAvatarCurrentResponseSchema
>;

export const AdminDefaultAvatarHistoryResponseSchema = z.object({
  items: z.array(AdminDefaultAvatarVersionSchema),
});

export type AdminDefaultAvatarHistoryResponse = z.infer<
  typeof AdminDefaultAvatarHistoryResponseSchema
>;

export const AdminDefaultAvatarSetCurrentRequestSchema = z.object({
  versionId: z.uuid(),
});

export type AdminDefaultAvatarSetCurrentRequest = z.infer<
  typeof AdminDefaultAvatarSetCurrentRequestSchema
>;

export const AdminDefaultAvatarSetCurrentResponseSchema = z.object({
  version: AdminDefaultAvatarVersionSchema,
});

export type AdminDefaultAvatarSetCurrentResponse = z.infer<
  typeof AdminDefaultAvatarSetCurrentResponseSchema
>;

export const AdminDefaultAvatarUploadResponseSchema = z.object({
  key: DefaultAvatarKeySchema,
  updatedAtMs: z.number().int().positive(),
});

export type AdminDefaultAvatarUploadResponse = z.infer<
  typeof AdminDefaultAvatarUploadResponseSchema
>;
