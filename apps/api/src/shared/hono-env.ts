export interface ApiBindings {
  APP_ENV?: string;
  CORS_ORIGINS?: string;
}

export interface ApiHonoEnv {
  Bindings: ApiBindings;
  Variables: {
    requestId: string;
    startedAt: number;
  };
}
