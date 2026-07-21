import { z } from "zod";

import { createPasswordLoginRequestSchema } from "./password-login.contract";

export const AdminPasswordLoginRequestSchema =
  createPasswordLoginRequestSchema();

export type AdminPasswordLoginRequest = z.infer<
  typeof AdminPasswordLoginRequestSchema
>;
