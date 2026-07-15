export interface ApiBindings {
  APP_ENV?: string;
  CORS_ORIGINS?: string;
  DB?: D1Database;
}

export interface ApiHonoEnv {
  Bindings: ApiBindings;
  Variables: {
    requestId: string;
    startedAt: number;
  };
}
