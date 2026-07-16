import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_ACCESS_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_NAME,
} from "@/src/auth/constants";

export function proxy(request: NextRequest) {
  const hasAccessToken = request.cookies.has(ADMIN_ACCESS_COOKIE_NAME);
  const hasRefreshToken = request.cookies.has(ADMIN_REFRESH_COOKIE_NAME);

  if (!hasAccessToken && !hasRefreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
