import { z } from "zod";

export const appEnvSchema = z.enum(["development", "test", "production"]);

export const apiBaseUrlSchema = z
  .string()
  .url()
  .transform((value) => value.replace(/\/+$/, ""));
