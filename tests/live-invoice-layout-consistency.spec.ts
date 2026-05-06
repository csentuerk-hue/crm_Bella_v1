import { expect, test } from "@playwright/test";

test("live invoice preview/pdf layout consistency checks", async ({ page, request }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/invoices", { waitUntil: "networkidle" });
  const previewLink = page
    .locator("a[href*='/invoices/'][href*='/preview']")
    .first();
  await expect(previewLink).toBeVisible();

  const previewHref = await previewLink.getAttribute("href");
  expect(previewHref).toBeTruthy();
  await page.goto(previewHref as string, { waitUntil: "networkidle" });

  const invoiceDocument = page.getByTestId("invoice-document");
  await expect(invoiceDocument).toBeVisible();

  const logo = invoiceDocument.locator("img[alt='Bella by Sobiella Logo']").first();
  await expect(logo).toBeVisible();
  const logoRatioDiff = await logo.evaluate((element) => {
    const img = element as HTMLImageElement;
    const renderedRatio = img.clientWidth / img.clientHeight;
    const naturalRatio = img.naturalWidth / img.naturalHeight;
    return Math.abs(renderedRatio - naturalRatio);
  });
  expect(logoRatioDiff).toBeLessThan(0.05);

  const paymentBlock = page.getByTestId("invoice-payment-block");
  await expect(paymentBlock).toBeVisible();
  const hasOverflow = await paymentBlock.locator("p").evaluateAll((nodes) =>
    nodes.some((node) => node.scrollWidth > node.clientWidth + 1),
  );
  expect(hasOverflow).toBeFalsy();

  const totalsSection = invoiceDocument
    .locator("section")
    .filter({ hasText: "Zwischensumme" })
    .first();
  await expect(totalsSection).toContainText("Endbetrag");
  const emphasis = await totalsSection.evaluate((element) => {
    const rows = Array.from(element.querySelectorAll("div"));
    const subtotalAmount = rows[0]?.querySelectorAll("span")[1] as HTMLElement | undefined;
    const totalAmount = rows[1]?.querySelectorAll("span")[1] as HTMLElement | undefined;
    const subtotalStyle = subtotalAmount ? getComputedStyle(subtotalAmount) : null;
    const totalStyle = totalAmount ? getComputedStyle(totalAmount) : null;
    return {
      subtotalSize: subtotalStyle ? Number.parseFloat(subtotalStyle.fontSize) : 0,
      totalSize: totalStyle ? Number.parseFloat(totalStyle.fontSize) : 0,
      subtotalWeight: subtotalStyle ? Number.parseInt(subtotalStyle.fontWeight, 10) : 0,
      totalWeight: totalStyle ? Number.parseInt(totalStyle.fontWeight, 10) : 0,
    };
  });
  expect(emphasis.totalSize).toBeGreaterThan(emphasis.subtotalSize);
  expect(emphasis.totalWeight).toBeGreaterThanOrEqual(emphasis.subtotalWeight);

  const iframe = page.locator("iframe[title^='Rechnung']").first();
  await expect(iframe).toBeVisible();
  const pdfSrc = await iframe.getAttribute("src");
  expect(pdfSrc).toBeTruthy();
  const pdfResponse = await request.get(pdfSrc as string);
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect(pdfResponse.headers()["content-disposition"]).toContain("inline");

  const hasJsonIssue =
    pageErrors.some((entry) => entry.includes("Unexpected end of JSON input")) ||
    consoleErrors.some((entry) => entry.includes("Unexpected end of JSON input"));
  expect(hasJsonIssue).toBeFalsy();
});
