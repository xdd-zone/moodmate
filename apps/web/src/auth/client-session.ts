import { WebSessionSchema, type WebAuthTokenResponse } from "@repo/contracts";
import { z } from "zod";

const STORAGE_KEY = "web:client-session";
const SESSION_CHANGED_EVENT_NAME = "web-client-session-changed";

const StoredWebSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAtMs: z.number().int().positive(),
  refreshToken: z.string().min(1),
  refreshTokenExpiresAtMs: z.number().int().positive(),
  session: WebSessionSchema,
});

export type StoredWebSession = z.infer<typeof StoredWebSessionSchema>;

let currentSession: StoredWebSession | null = null;
let hasLoadedSession = false;

export function readClientSession(): StoredWebSession | null {
  if (hasLoadedSession) {
    return currentSession;
  }

  hasLoadedSession = true;

  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const result = StoredWebSessionSchema.safeParse(JSON.parse(rawValue));
    const nowMs = Date.now();

    if (
      !result.success ||
      result.data.refreshTokenExpiresAtMs <= nowMs ||
      result.data.session.expiresAtMs <= nowMs
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    currentSession = result.data;
    return currentSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveClientSession(input: WebAuthTokenResponse): void {
  currentSession = StoredWebSessionSchema.parse(input);
  hasLoadedSession = true;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSession));
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT_NAME));
  }
}

export function clearClientSession(): void {
  currentSession = null;
  hasLoadedSession = true;

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT_NAME));
  }
}
