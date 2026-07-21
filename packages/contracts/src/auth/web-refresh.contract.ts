import { z } from "zod";

import { WebAuthTokenResponseSchema } from "./web-auth.contract";

export const WebRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
});

export type WebRefreshRequest = z.infer<typeof WebRefreshRequestSchema>;

export const WebTokenRefreshResponseSchema = WebAuthTokenResponseSchema;

export type WebTokenRefreshResponse = z.infer<
  typeof WebTokenRefreshResponseSchema
>;
