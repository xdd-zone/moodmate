import { z } from "zod";

import { WebAuthTokenResponseSchema } from "./web-auth.contract";

export const WebGithubAuthUrlResponseSchema = z.object({
  state: z.string().min(1),
  url: z.url(),
});

export type WebGithubAuthUrlResponse = z.infer<
  typeof WebGithubAuthUrlResponseSchema
>;

export const WebGithubTicketLoginRequestSchema = z.object({
  ticket: z.string().min(1).max(4096),
});

export type WebGithubTicketLoginRequest = z.infer<
  typeof WebGithubTicketLoginRequestSchema
>;

export const WebGithubTicketLoginResponseSchema = WebAuthTokenResponseSchema;

export type WebGithubTicketLoginResponse = z.infer<
  typeof WebGithubTicketLoginResponseSchema
>;
