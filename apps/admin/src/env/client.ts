import { z } from "zod";

import { appEnvSchema } from "./schema";

const adminClientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: appEnvSchema,
});

export type AdminClientEnv = z.infer<typeof adminClientEnvSchema>;

export function getAdminClientEnv(): AdminClientEnv {
  return adminClientEnvSchema.parse({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  });
}
