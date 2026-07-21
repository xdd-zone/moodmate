import { z } from "zod";

import { createPasswordLoginRequestSchema } from "./password-login.contract";
import { WebAuthTokenResponseSchema } from "./web-auth.contract";

export const WebPasswordLoginRequestSchema = createPasswordLoginRequestSchema();

export type WebPasswordLoginRequest = z.infer<
  typeof WebPasswordLoginRequestSchema
>;

export const WebPasswordLoginResponseSchema = WebAuthTokenResponseSchema;

export type WebPasswordLoginResponse = z.infer<
  typeof WebPasswordLoginResponseSchema
>;
