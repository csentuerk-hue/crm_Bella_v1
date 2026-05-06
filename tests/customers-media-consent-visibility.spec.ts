import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("capture customer media consent visibility", async ({ page, request }) => {
  const unique = Date.now().toString();
  const baseName = `ConsentShot ${unique}`;
  const customerWithConsent = `${baseName} Ja`;
  const customerWithoutConsent = `${baseName} Nein`;

  const withConsentResponse = await request.post("/api/customers", {
    data: {
      name: customerWithConsent,
      phone: "01700001111",
      email: null,
      birthday: null,
      preferences: null,
      allergies: null,
      notes: null,
      photoUrl: null,
      status: "AKTIV",
      archived: false,
      mediaConsent: true,
    },
  });
  expect(withConsentResponse.ok()).toBeTruthy();

  const withoutConsentResponse = await request.post("/api/customers", {
    data: {
      name: customerWithoutConsent,
      phone: "01700002222",
      email: null,
      birthday: null,
      preferences: null,
      allergies: null,
      notes: null,
      photoUrl: null,
      status: "AKTIV",
      archived: false,
      mediaConsent: false,
    },
  });
  expect(withoutConsentResponse.ok()).toBeTruthy();

  const shotsDir = path.resolve(process.cwd(), "screenshots");
  fs.mkdirSync(shotsDir, { recursive: true });

  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.goto("/customers");
  await page.waitForLoadState("networkidle");

  await page.getByPlaceholder("Suche nach Name").fill(baseName);

  const listColumn = page.getByTestId("customers-list-column");
  const consentYesRow = listColumn.locator("button", { hasText: customerWithConsent }).first();
  const consentNoRow = listColumn.locator("button", { hasText: customerWithoutConsent }).first();

  await expect(consentYesRow).toBeVisible();
  await expect(consentNoRow).toBeVisible();

  await consentYesRow.click();
  await expect(page.getByText("Medienfreigabe: Ja").first()).toBeVisible();

  await page.screenshot({
    path: path.join(shotsDir, "customers-media-consent-visibility.png"),
    fullPage: true,
  });
});
