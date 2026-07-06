import { z } from "zod";

export const ApiEnvSchema = z.enum(["development", "test", "production"]);

export type ApiEnvValue = z.infer<typeof ApiEnvSchema>;

export const HealthResponseSchema = z.object({
  env: ApiEnvSchema,
  service: z.literal("api"),
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
