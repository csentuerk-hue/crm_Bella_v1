import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("live deploy check: customers media consent, delete and reload", async ({
  page,
  request,
}) => {
  const unique = Date.now().toString();
  const mediaCustomerName = `Live Consent ${unique}`;
  const deleteCustomerName = `Live Delete ${unique}`;

  const mediaCustomerResponse = await request.post("/api/customers", {
    data: {
      name: mediaCustomerName,
      phone: "01701112222",
      email: null,
      birthday: null,
      preferences: null,
      allergies: null,
      notes: "Live deploy media visibility check",
      photoUrl: null,
      status: "AKTIV",
      archived: false,
      mediaConsent: true,
    },
  });
  expect(mediaCustomerResponse.ok()).toBeTruthy();

  const deleteCustomerResponse = await request.post("/api/customers", {
    data: {
      name: deleteCustomerName,
      phone: "01703334444",
      email: null,
      birthday: null,
      preferences: null,
      allergies: null,
      notes: "Live deploy delete check",
      photoUrl: null,
      status: "NEU",
      archived: false,
      mediaConsent: false,
    },
  });
  expect(deleteCustomerResponse.ok()).toBeTruthy();

  const shotsDir = path.resolve(process.cwd(), "screenshots");
  fs.mkdirSync(shotsDir, { recursive: true });

  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.goto("/customers");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(shotsDir, "live-customers-open.png"),
    fullPage: true,
  });

  const listColumn = page.getByTestId("customers-list-column");
  await page.getByPlaceholder("Suche nach Name").fill("Live ");

  const mediaRow = listColumn.locator("button", { hasText: mediaCustomerName }).first();
  const deleteRow = listColumn.locator("button", { hasText: deleteCustomerName }).first();
  await expect(mediaRow).toBeVisible();
  await expect(deleteRow).toBeVisible();
  await expect(mediaRow.getByText("Medienfreigabe vorhanden")).toBeVisible();
  await expect(deleteRow.getByText("Keine Medienfreigabe")).toBeVisible();

  await mediaRow.click();
  await expect(page.getByText("Medienfreigabe: Ja").first()).toBeVisible();
  await page.screenshot({
    path: path.join(shotsDir, "live-media-consent-check.png"),
    fullPage: true,
  });

  await deleteRow.click();
  await page.getByRole("button", { name: "Kundin loeschen" }).click();
  await expect(page.getByRole("heading", { name: "Kundin dauerhaft loeschen" })).toBeVisible();
  await page.screenshot({
    path: path.join(shotsDir, "live-delete-confirmation.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Endgueltig loeschen" }).click();
  await expect(page.getByText("Kundin wurde dauerhaft geloescht.")).toBeVisible();

  await page.getByPlaceholder("Suche nach Name").fill(deleteCustomerName);
  await expect(listColumn.locator("button", { hasText: deleteCustomerName })).toHaveCount(0);

  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Suche nach Name").fill(deleteCustomerName);
  await expect(listColumn.locator("button", { hasText: deleteCustomerName })).toHaveCount(0);
  await page.screenshot({
    path: path.join(shotsDir, "live-reload-after-delete.png"),
    fullPage: true,
  });
});
