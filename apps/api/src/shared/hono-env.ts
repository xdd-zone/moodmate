import type { AdminSession } from "@repo/contracts";

export interface ApiBindings {
  APP_ENV?: string;
  AUTH_ACCESS_SECRET?: string;
  AUTH_REFRESH_SECRET?: string;
  AVATAR_BUCKET?: R2Bucket;
  CORS_ORIGINS?: string;
  DB?: D1Database;
}

export interface ApiHonoEnv {
  Bindings: ApiBindings;
  Variables: {
    adminSession: AdminSession;
    requestId: string;
    startedAt: number;
  };
}
