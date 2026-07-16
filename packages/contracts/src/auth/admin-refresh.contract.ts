import { z } from "zod";

export const AdminRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
});

export type AdminRefreshRequest = z.infer<typeof AdminRefreshRequestSchema>;
