import { cookies } from "next/headers";

import {
  ADMIN_ACCESS_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_NAME,
} from "@/src/auth/constants";
import { getAdminServerEnv } from "@/src/env/server";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function getCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: getAdminServerEnv().APP_ENV === "production",
  };
}

function getRemainingSeconds(expiresAtMs: number) {
  return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
}

export async function readAdminAuthCookies() {
  const cookieStore = await cookies();

  return {
    accessToken: cookieStore.get(ADMIN_ACCESS_COOKIE_NAME)?.value,
    cookieStore,
    refreshToken: cookieStore.get(ADMIN_REFRESH_COOKIE_NAME)?.value,
  };
}

export function setAdminAuthCookies(
  cookieStore: CookieStore,
  input: {
    accessToken: string;
    accessTokenExpiresAtMs: number;
    refreshToken: string;
    refreshTokenExpiresAtMs: number;
  },
) {
  const options = getCookieOptions();

  cookieStore.set(ADMIN_ACCESS_COOKIE_NAME, input.accessToken, {
    ...options,
    maxAge: getRemainingSeconds(input.accessTokenExpiresAtMs),
  });
  cookieStore.set(ADMIN_REFRESH_COOKIE_NAME, input.refreshToken, {
    ...options,
    maxAge: getRemainingSeconds(input.refreshTokenExpiresAtMs),
  });
}

export function clearAdminAuthCookies(cookieStore: CookieStore) {
  const options = getCookieOptions();

  cookieStore.set(ADMIN_ACCESS_COOKIE_NAME, "", {
    ...options,
    maxAge: 0,
  });
  cookieStore.set(ADMIN_REFRESH_COOKIE_NAME, "", {
    ...options,
    maxAge: 0,
  });
}
