import { z } from "zod";

export const AdminLogoutRequestSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
});

export type AdminLogoutRequest = z.infer<typeof AdminLogoutRequestSchema>;

export const AdminLogoutResponseSchema = z.object({
  success: z.literal(true),
});

export type AdminLogoutResponse = z.infer<typeof AdminLogoutResponseSchema>;
