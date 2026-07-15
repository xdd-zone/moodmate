import { createApiApp } from "@/bootstrap/create-app";
import type { ApiRoutesType } from "@/routes";

const app = createApiApp();

export type AppType = ApiRoutesType;

export { app };

export default app;
