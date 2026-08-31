import { expect, test } from "@playwright/test";

import { CRM_SESSION_COOKIE } from "../src/lib/auth";

test.describe("CRM access protection", () => {
  test("redirects unauthenticated pages and blocks direct API access", async ({ page, request }) => {
    const apiResponse = await request.get("/api/customers");
    expect(apiResponse.status()).toBe(401);
    await expect(apiResponse.json()).resolves.toEqual({ error: "Nicht authentifiziert." });

    await page.goto("/customers");
    await expect(page).toHaveURL(/\/login\?next=%2Fcustomers$/);
    await expect(page.getByRole("heading", { name: "Bella CRM" })).toBeVisible();
  });

  test("rejects a wrong password without creating a session", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("Passwort").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Anmelden" }).click();

    await expect(page).toHaveURL(/\/login\?error=1/);
    await expect(page.getByRole("alert")).toContainText("Passwort ist nicht korrekt");

    const cookies = await context.cookies();
    expect(cookies.some((cookie) => cookie.name === CRM_SESSION_COOKIE)).toBe(false);
  });

  test("creates an HttpOnly session and removes it on logout", async ({ page, context }) => {
    await page.goto("/login?next=/customers");
    await page.getByLabel("Passwort").fill(process.env.CRM_ADMIN_PASSWORD as string);
    await page.getByRole("button", { name: "Anmelden" }).click();

    await expect(page).toHaveURL(/\/customers$/);

    const sessionCookie = (await context.cookies()).find(
      (cookie) => cookie.name === CRM_SESSION_COOKIE,
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe("Lax");

    await page.getByRole("button", { name: "Abmelden" }).click();
    await expect(page).toHaveURL(/\/login$/);

    const cookiesAfterLogout = await context.cookies();
    expect(cookiesAfterLogout.some((cookie) => cookie.name === CRM_SESSION_COOKIE)).toBe(false);

    const apiResponse = await page.request.get("/api/customers");
    expect(apiResponse.status()).toBe(401);
  });
});
