import { z } from "zod";

import { apiBaseUrlSchema, appEnvSchema } from "./schema";

const webServerEnvSchema = z.object({
  APP_ENV: appEnvSchema,
  API_BASE_URL: apiBaseUrlSchema,
});

export type WebServerEnv = z.infer<typeof webServerEnvSchema>;

export function getWebServerEnv(): WebServerEnv {
  return webServerEnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    API_BASE_URL: process.env.API_BASE_URL,
  });
}
