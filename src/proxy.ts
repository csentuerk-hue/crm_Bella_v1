import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CRM_SESSION_COOKIE,
  getAuthConfigurationIssue,
  isAuthConfigured,
  verifySessionToken,
} from "@/lib/auth";

const PUBLIC_AUTH_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

function configurationUnavailableResponse(request: NextRequest) {
  const issue = getAuthConfigurationIssue();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "CRM-Zugriffsschutz ist nicht konfiguriert." },
      { status: 503 },
    );
  }

  return new NextResponse(
    `Bella CRM ist noch nicht fuer den geschuetzten Betrieb konfiguriert. ${issue ?? ""}`,
    {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    },
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next();
    }

    return configurationUnavailableResponse(request);
  }

  const token = request.cookies.get(CRM_SESSION_COOKIE)?.value;
  const authenticated = verifySessionToken(token);

  if (pathname === "/login") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (PUBLIC_AUTH_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
