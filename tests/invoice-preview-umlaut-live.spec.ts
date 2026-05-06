import { expect, test } from "@playwright/test";

test("live invoice preview renders umlauts and no fallback text", async ({ page }) => {
  await page.goto(
    "/invoices/cmo80y2wc0001l804b1ewlaki/preview?invoiceNumber=BBS-2026-0006.CT",
    { waitUntil: "networkidle" },
  );

  const document = page.locator("[data-testid='invoice-document']").first();
  await expect(document).toBeVisible();

  const text = await document.innerText();

  expect(text).toContain("Zahlungsart: Überweisung");
  expect(text).toContain("Bitte überweisen Sie den Betrag innerhalb von 7 Werktagen.");
  expect(text).toContain("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.");

  expect(text).not.toContain("Ueberweisung");
  expect(text).not.toContain("ueberweisen");
  expect(text).not.toContain("Gemaess");
});

