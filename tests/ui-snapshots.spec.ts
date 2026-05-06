import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("UI snapshots for dashboard customers appointments", async ({ page }) => {
  const shotsDir = path.resolve(process.cwd(), "screenshots");
  fs.mkdirSync(shotsDir, { recursive: true });

  await page.setViewportSize({ width: 1920, height: 1200 });

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  const dashboardMainWidth = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return 0;
    return Math.round(main.getBoundingClientRect().width);
  });
  expect(dashboardMainWidth).toBeGreaterThan(1100);
  await page.screenshot({
    path: path.join(shotsDir, "dashboard.png"),
    fullPage: true,
  });

  await page.goto("/customers");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(shotsDir, "customers.png"),
    fullPage: true,
  });

  await page.goto("/appointments");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(shotsDir, "appointments.png"),
    fullPage: true,
  });

  await page.goto("/invoices");
  await page.waitForLoadState("networkidle");
  const previewLinks = page.getByRole("link", { name: /Vorschau oeffnen/i });
  if ((await previewLinks.count()) > 0) {
    await previewLinks.first().click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(shotsDir, "invoice-preview.png"),
      fullPage: true,
    });
  } else {
    await page.screenshot({
      path: path.join(shotsDir, "invoices.png"),
      fullPage: true,
    });
  }
});
