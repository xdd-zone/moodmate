import { z } from "zod";

import { ApiEnvSchema } from "./health.contract";

export const PingRequestSchema = z.object({
  name: z.string().trim().min(1),
});

export type PingRequest = z.infer<typeof PingRequestSchema>;

export const PingResponseSchema = z.object({
  env: ApiEnvSchema,
  message: z.string(),
  service: z.literal("api"),
});

export type PingResponse = z.infer<typeof PingResponseSchema>;
