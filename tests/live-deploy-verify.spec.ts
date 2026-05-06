import { expect, test } from "@playwright/test";

type InvoiceApiRecord = {
  id: string;
  invoiceNumber: string | null;
  subtotalCents: number;
  totalCents: number;
  items: Array<{
    totalCents: number;
  }>;
};

test("live deployment exposes synced dashboard and invoice implementation", async ({
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByTestId("dashboard-planning-grid")).toBeVisible();

  await page.goto("/invoices", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Rechnungen" })).toBeVisible();

  const invoiceApi = await request.get("/api/invoices");
  expect(invoiceApi.ok()).toBeTruthy();
  expect(invoiceApi.headers()["content-type"]).toContain("application/json");
  const invoices = (await invoiceApi.json()) as InvoiceApiRecord[];
  expect(Array.isArray(invoices)).toBeTruthy();
  expect(invoices.length).toBeGreaterThan(0);

  const sample = invoices.slice(0, 8);
  for (const invoice of sample) {
    const sum = (invoice.items ?? []).reduce((acc, item) => acc + (item.totalCents ?? 0), 0);
    expect(invoice.subtotalCents).toBe(sum);
    expect(invoice.totalCents).toBe(sum);
  }

  const invoiceForPreview = invoices.find(
    (invoice) => Boolean(invoice.invoiceNumber && invoice.id),
  );
  expect(invoiceForPreview).toBeTruthy();

  await page.goto(
    `/invoices/${invoiceForPreview!.id}/preview?invoiceNumber=${encodeURIComponent(invoiceForPreview!.invoiceNumber!)}`,
    { waitUntil: "networkidle" },
  );
  const document = page.getByTestId("invoice-document");
  await expect(document).toBeVisible();
  await expect(document).toContainText("Zwischensumme");
  await expect(document).toContainText("Endbetrag");
  await expect(page.getByTestId("invoice-payment-block")).not.toContainText("IBAN: -");
  await expect(page.getByTestId("invoice-payment-block")).not.toContainText("Kontoinhaber: -");
  await expect(page.getByTestId("invoice-payment-block")).not.toContainText("BIC: -");

  const hasJsonParseIssue =
    pageErrors.some((entry) => entry.includes("Unexpected end of JSON input")) ||
    consoleErrors.some((entry) => entry.includes("Unexpected end of JSON input"));
  expect(hasJsonParseIssue).toBeFalsy();
});
