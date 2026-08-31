import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CRM_SESSION_COOKIE,
  createSessionToken,
  getAuthConfigurationIssue,
  sanitizeReturnTo,
  sessionCookieOptions,
  verifyAdminPassword,
} from "@/lib/auth";

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const configurationIssue = getAuthConfigurationIssue();
  if (configurationIssue) {
    return NextResponse.json(
      { error: "CRM-Zugriffsschutz ist nicht konfiguriert." },
      { status: 503 },
    );
  }

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 403 });
  }

  const formData = await request.formData();
  const passwordValue = formData.get("password");
  const returnToValue = formData.get("returnTo");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const returnTo = sanitizeReturnTo(typeof returnToValue === "string" ? returnToValue : null);

  if (!verifyAdminPassword(password)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("next", returnTo);
    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(CRM_SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
  return response;
}
