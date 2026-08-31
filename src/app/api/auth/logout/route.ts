import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { CRM_SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(CRM_SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
