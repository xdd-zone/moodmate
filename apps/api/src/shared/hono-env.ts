import type { AdminSession, WebSession } from "@repo/contracts";

export interface ApiBindings {
  APP_ENV?: string;
  AUTH_ACCESS_SECRET?: string;
  AUTH_REFRESH_SECRET?: string;
  AVATAR_BUCKET?: R2Bucket;
  CORS_ORIGINS?: string;
  DB?: D1Database;
  GITHUB_OAUTH_CALLBACK_URL?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  LLM_CONFIG_ENC_KEY?: string;
  WEB_ORIGIN?: string;
}

export interface ApiHonoEnv {
  Bindings: ApiBindings;
  Variables: {
    adminSession: AdminSession;
    requestId: string;
    startedAt: number;
    webSession: WebSession;
  };
}
