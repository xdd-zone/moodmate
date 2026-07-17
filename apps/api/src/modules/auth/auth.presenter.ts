import type { AdminSession } from "@repo/contracts";

export function presentAdminSession(input: {
  displayName: string;
  email: string;
  expiresAtMs: number;
  roles: string[];
  sessionId: string;
  userId: string;
}): AdminSession {
  return {
    displayName: input.displayName,
    email: input.email,
    expiresAtMs: input.expiresAtMs,
    roles: input.roles,
    sessionId: input.sessionId,
    userId: input.userId,
  };
}
