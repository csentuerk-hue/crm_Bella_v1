import { expect, test } from "@playwright/test";

test("free invoice can be created without appointment", async ({ page, request }, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const customerName = `Freie Rechnung Kundin ${unique}`;

  const customerResponse = await request.post("/api/customers", {
    data: {
      name: customerName,
      mediaConsent: false,
      status: "NEU",
      archived: false,
      billingAddressEnabled: false,
    },
  });
  expect(customerResponse.ok()).toBeTruthy();

  const customer = await customerResponse.json();
  const customerId = customer.id as string;
  expect(customerId).toBeTruthy();

  await page.goto("/invoices");
  const createPanel = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Rechnungsentwurf anlegen" }) })
    .first();

  await createPanel.getByRole("button", { name: "Freie Rechnung" }).click();

  const customerSelect = createPanel.locator("label:has-text('Kundin') select").first();
  await customerSelect.selectOption(customerId);

  await createPanel
    .locator("input[placeholder='Bezeichnung']")
    .first()
    .fill("Individuelle Studioleistung");
  await createPanel.locator("input[placeholder='1']").first().fill("2");
  await createPanel.locator("input[placeholder='49,00']").first().fill("39,50");

  await createPanel.getByRole("button", { name: "Freien Entwurf erstellen" }).click();
  await expect(page.getByText("Freier Rechnungsentwurf wurde erstellt.")).toBeVisible();

  const invoicesResponse = await request.get(
    `/api/invoices?customerId=${encodeURIComponent(customerId)}&lifecycle=ENTWURF`,
  );
  expect(invoicesResponse.ok()).toBeTruthy();
  const invoices = (await invoicesResponse.json()) as Array<{
    id: string;
    invoiceNumber: string | null;
    paymentMethod: "BANK_TRANSFER" | "CASH" | "CARD";
    totalCents: number;
    items: Array<{ service: string; quantity: number; unitPriceCents: number }>;
  }>;
  const createdInvoice = invoices.find((invoice) =>
    invoice.items.some((item) => item.service === "Individuelle Studioleistung"),
  );
  expect(createdInvoice).toBeTruthy();
  if (!createdInvoice) {
    throw new Error("Freier Rechnungsentwurf mit manueller Position wurde nicht gefunden.");
  }
  expect(createdInvoice.totalCents).toBe(7900);
  expect(createdInvoice.paymentMethod).toBe("CASH");

  const previewPath = createdInvoice.invoiceNumber
    ? `/invoices/${createdInvoice.id}/preview?invoiceNumber=${encodeURIComponent(createdInvoice.invoiceNumber)}`
    : `/invoices/${createdInvoice.id}/preview`;
  await page.goto(previewPath);

  await expect(page).toHaveURL(/\/invoices\/.*\/preview/);
  await expect(page.locator("iframe[title^='Rechnung']")).toBeVisible();
  await expect(page.locator("[data-testid='invoice-document']")).toContainText("Individuelle Studioleistung");
  await expect(page.locator("[data-testid='invoice-document']")).toContainText("79,00");
});
