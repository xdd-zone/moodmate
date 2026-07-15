import { z } from "zod";

import { apiBaseUrlSchema, appEnvSchema } from "./schema";

const adminClientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: appEnvSchema,
  NEXT_PUBLIC_API_BASE_URL: apiBaseUrlSchema,
});

export type AdminClientEnv = z.infer<typeof adminClientEnvSchema>;

export function getAdminClientEnv(): AdminClientEnv {
  return adminClientEnvSchema.parse({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
}
