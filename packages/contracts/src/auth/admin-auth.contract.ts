import { z } from "zod";

export const AdminRoleSchema = z.string().trim().min(1);

export const AdminSessionSchema = z.object({
  displayName: z.string().min(1),
  email: z.email(),
  expiresAtMs: z.number().int().positive(),
  roles: z.array(AdminRoleSchema).min(1),
  sessionId: z.uuid(),
  userId: z.uuid(),
});

export type AdminSession = z.infer<typeof AdminSessionSchema>;

export const AdminAuthTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAtMs: z.number().int().positive(),
  refreshToken: z.string().min(1),
  refreshTokenExpiresAtMs: z.number().int().positive(),
  session: AdminSessionSchema,
});

export type AdminAuthTokenResponse = z.infer<
  typeof AdminAuthTokenResponseSchema
>;
