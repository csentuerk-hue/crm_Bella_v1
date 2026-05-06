import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("invoice pdf preview screenshot", async ({ page }) => {
  const shotsDir = path.resolve(process.cwd(), "screenshots");
  fs.mkdirSync(shotsDir, { recursive: true });

  await page.setViewportSize({ width: 1600, height: 1200 });
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

  const iframe = page.locator("iframe[title^='Rechnung']").first();
  await expect(iframe).toBeVisible();

  const pdfSrc = await iframe.getAttribute("src");
  expect(pdfSrc).toBeTruthy();

  await page.goto(pdfSrc as string);
  await page.waitForLoadState("networkidle");

  await page.screenshot({
    path: path.join(shotsDir, "invoice-pdf-preview.png"),
    fullPage: true,
  });
});
