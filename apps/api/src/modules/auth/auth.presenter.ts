import type { AdminSession } from "@repo/contracts";

export function presentAdminSession(input: {
  displayName: string;
  email: string;
  expiresAtMs: number;
  sessionId: string;
  userId: string;
}): AdminSession {
  return {
    displayName: input.displayName,
    email: input.email,
    expiresAtMs: input.expiresAtMs,
    roles: ["admin_owner"],
    sessionId: input.sessionId,
    userId: input.userId,
  };
}
