import { z } from "zod";

export const WebRoleSchema = z.string().trim().min(1);

export const WebSessionSchema = z.object({
  app: z.literal("web"),
  displayName: z.string().min(1),
  email: z.email(),
  expiresAtMs: z.number().int().positive(),
  roles: z.array(WebRoleSchema).min(1),
  sessionId: z.uuid(),
  userId: z.uuid(),
});

export type WebSession = z.infer<typeof WebSessionSchema>;

export const WebAuthTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAtMs: z.number().int().positive(),
  refreshToken: z.string().min(1),
  refreshTokenExpiresAtMs: z.number().int().positive(),
  session: WebSessionSchema,
});

export type WebAuthTokenResponse = z.infer<typeof WebAuthTokenResponseSchema>;

export const WebUserProfileSchema = WebSessionSchema.pick({
  displayName: true,
  email: true,
  roles: true,
  userId: true,
});

export type WebUserProfile = z.infer<typeof WebUserProfileSchema>;
