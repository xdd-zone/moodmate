import type { AdminSession, WebSession } from "@repo/contracts";

interface SessionPresentationInput {
  displayName: string;
  email: string;
  expiresAtMs: number;
  roles: string[];
  sessionId: string;
  userId: string;
}

export function presentAdminSession(
  input: SessionPresentationInput,
): AdminSession {
  return {
    displayName: input.displayName,
    email: input.email,
    expiresAtMs: input.expiresAtMs,
    roles: input.roles,
    sessionId: input.sessionId,
    userId: input.userId,
  };
}

export function presentWebSession(input: SessionPresentationInput): WebSession {
  return {
    app: "web",
    displayName: input.displayName,
    email: input.email,
    expiresAtMs: input.expiresAtMs,
    roles: input.roles,
    sessionId: input.sessionId,
    userId: input.userId,
  };
}
