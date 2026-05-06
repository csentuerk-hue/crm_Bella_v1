import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("invoice preview screenshot", async ({ page }) => {
  const shotsDir = path.resolve(process.cwd(), "screenshots");
  fs.mkdirSync(shotsDir, { recursive: true });

  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto("/invoices");
  await page.waitForLoadState("networkidle");

  const previewLink = page
    .locator("a[href*='/invoices/'][href*='/preview']")
    .first();

  await expect(previewLink).toBeVisible();
  const href = await previewLink.getAttribute("href");
  expect(href).toBeTruthy();

  await page.goto(href as string);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Rechnungsvorschau" })).toBeVisible();

  await page.screenshot({
    path: path.join(shotsDir, "invoice-preview-final.png"),
    fullPage: true,
  });
});
