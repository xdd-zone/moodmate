import {
  AdminLogoutResponseSchema,
  AdminSessionSchema,
  BizCode,
  type AdminPasswordLoginRequest,
  type AdminSession,
} from "@repo/contracts";

import { http, HttpRequestError } from "@/src/lib/http";

let refreshPromise: Promise<AdminSession> | null = null;

export function loginAdmin(payload: AdminPasswordLoginRequest) {
  return http.post("/api/auth/login", payload, AdminSessionSchema);
}

function refreshAdminSession() {
  if (!refreshPromise) {
    refreshPromise = http
      .post("/api/auth/refresh", {}, AdminSessionSchema)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function isUnauthorized(error: unknown) {
  return error instanceof HttpRequestError && error.status === 401;
}

export async function withAdminSessionRecovery<TData>(
  request: () => Promise<TData>,
) {
  try {
    return await request();
  } catch (error) {
    if (
      !(error instanceof HttpRequestError) ||
      error.code !== BizCode.AUTH_ACCESS_EXPIRED
    ) {
      if (isUnauthorized(error)) {
        redirectToLogin();
      }

      throw error;
    }
  }

  try {
    await refreshAdminSession();
  } catch (error) {
    redirectToLogin();
    throw error;
  }

  try {
    return await request();
  } catch (error) {
    if (isUnauthorized(error)) {
      redirectToLogin();
    }

    throw error;
  }
}

export function getAdminSession() {
  return withAdminSessionRecovery(() =>
    http.get("/api/auth/session", AdminSessionSchema),
  );
}

export function logoutAdmin() {
  return http.post("/api/auth/logout", {}, AdminLogoutResponseSchema);
}
