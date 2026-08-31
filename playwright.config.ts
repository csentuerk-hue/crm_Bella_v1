import { defineConfig, devices } from "@playwright/test";

import {
  CRM_SESSION_COOKIE,
  CRM_SESSION_TTL_SECONDS,
  createSessionToken,
} from "./src/lib/auth";

const E2E_ADMIN_PASSWORD = "Bella-E2E-Only-Password-2026!";
const E2E_AUTH_SECRET = "bella-e2e-only-auth-secret-not-for-production-2026";
const NON_FUNCTIONAL_TESTS = [
  "**/*live*.spec.ts",
  "**/*snapshots.spec.ts",
  "**/*screenshot.spec.ts",
];

process.env.CRM_ADMIN_PASSWORD ??= E2E_ADMIN_PASSWORD;
process.env.CRM_AUTH_SECRET ??= E2E_AUTH_SECRET;

const authenticatedStorageState = {
  cookies: [
    {
      name: CRM_SESSION_COOKIE,
      value: createSessionToken(),
      domain: "localhost",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + CRM_SESSION_TTL_SECONDS,
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
};

export default defineConfig({
  testDir: "./tests",
  testIgnore: NON_FUNCTIONAL_TESTS,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --hostname localhost --port 3000",
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "auth",
      testMatch: "**/auth-access.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: "chromium",
      testIgnore: ["**/auth-access.spec.ts", ...NON_FUNCTIONAL_TESTS],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authenticatedStorageState,
      },
    },
  ],
});
