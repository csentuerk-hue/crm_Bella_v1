import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const CRM_SESSION_COOKIE = "bella_crm_session";
export const CRM_SESSION_TTL_SECONDS = 60 * 60 * 12;

const PASSWORD_MIN_LENGTH = 12;
const SECRET_MIN_LENGTH = 32;

export function getAuthConfigurationIssue(): string | null {
  const password = process.env.CRM_ADMIN_PASSWORD;
  const secret = process.env.CRM_AUTH_SECRET;

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `CRM_ADMIN_PASSWORD muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`;
  }

  if (!secret || secret.length < SECRET_MIN_LENGTH) {
    return `CRM_AUTH_SECRET muss mindestens ${SECRET_MIN_LENGTH} Zeichen lang sein.`;
  }

  return null;
}

export function isAuthConfigured(): boolean {
  return getAuthConfigurationIssue() === null;
}

function hash(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(hash(left), hash(right));
}

function getSigningSecret(): string {
  const issue = getAuthConfigurationIssue();
  if (issue) {
    throw new Error(issue);
  }

  return process.env.CRM_AUTH_SECRET as string;
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload, "utf8").digest("base64url");
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = process.env.CRM_ADMIN_PASSWORD;
  if (!expected || !isAuthConfigured()) {
    return false;
  }

  return safeEqual(candidate, expected);
}

export function createSessionToken(now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + CRM_SESSION_TTL_SECONDS;
  const nonce = randomBytes(18).toString("base64url");
  const payload = `v1.${expiresAt}.${nonce}`;

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token || !isAuthConfigured()) {
    return false;
  }

  const [version, expiresRaw, nonce, signature, ...rest] = token.split(".");
  if (rest.length > 0 || version !== "v1" || !expiresRaw || !nonce || !signature) {
    return false;
  }

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) {
    return false;
  }

  const payload = `${version}.${expiresRaw}.${nonce}`;
  const expectedSignature = sign(payload);

  return safeEqual(signature, expectedSignature);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CRM_SESSION_TTL_SECONDS,
  };
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  if (value.startsWith("/api/") || value === "/login" || value.startsWith("/login?")) {
    return "/dashboard";
  }

  return value;
}
