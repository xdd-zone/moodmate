import { z } from "zod";

import { apiBaseUrlSchema, appEnvSchema } from "./schema";

const adminServerEnvSchema = z.object({
  APP_ENV: appEnvSchema,
  API_BASE_URL: apiBaseUrlSchema,
});

export type AdminServerEnv = z.infer<typeof adminServerEnvSchema>;

export function getAdminServerEnv(): AdminServerEnv {
  return adminServerEnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    API_BASE_URL: process.env.API_BASE_URL,
  });
}
