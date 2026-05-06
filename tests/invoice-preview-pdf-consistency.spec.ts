import { expect, test } from "@playwright/test";

type InvoiceSettingsPayload = {
  businessName: string;
  ownerName: string;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  phone: string;
  email: string;
  taxNumber: string;
  vatId: string;
  bankAccountHolder: string;
  bankIban: string;
  bankBic: string;
  bankName: string;
  smallBusinessEnabled: boolean;
  defaultPaymentDeadlineBusinessDays: number;
  defaultCurrency: string;
  defaultPaymentMethod: "BANK_TRANSFER" | "CASH" | "CARD";
  invoicePrefix: string;
  recipientLabel: string;
  transferPaymentTitle: string;
  transferPaymentNotice: string;
  cashPaymentTitle: string;
  cashPaymentNote: string;
  cardPaymentTitle: string;
  cardPaymentNote: string;
  legalSmallBusinessNote: string;
  closingText: string;
  additionalFooterNote: string;
};

test("invoice preview and pdf stay consistent with settings-based footer and wrapped payment text", async ({
  page,
  request,
}, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const shortRef = unique.slice(-6);
  const closingText = `Vielen Dank fuer Ihren Besuch! Referenz ${shortRef}`;
  const longTransferNotice =
    "Bitte ueberweisen Sie den Gesamtbetrag innerhalb von 10 Werktagen auf das angegebene Konto. " +
    "Verwendungszweck: Rechnungsnummer angeben. Rueckfragen bitte per E-Mail an das Studio senden.";

  const originalSettingsResponse = await request.get("/api/settings/invoice");
  expect(originalSettingsResponse.ok()).toBeTruthy();
  const originalSettings = (await originalSettingsResponse.json()) as InvoiceSettingsPayload;

  const settingsResponse = await request.put("/api/settings/invoice", {
    data: {
      ...originalSettings,
      businessName: "Bella by Sobiella",
      ownerName: "Nathaly Sobiella",
      street: "Westumer Landstr.",
      houseNumber: "40a",
      zipCode: "48282",
      city: "Emsdetten",
      phone: "+4915141879621",
      email: "bellabysobiella@gmail.com",
      taxNumber: "123/456/78901",
      vatId: "",
      bankAccountHolder: "Nathaly Sobiella",
      bankIban: "DE55403619061012154300",
      bankBic: "GENODEM1IBB",
      bankName: "Volksbank",
      smallBusinessEnabled: true,
      defaultPaymentDeadlineBusinessDays: 10,
      defaultCurrency: "EUR",
      defaultPaymentMethod: "BANK_TRANSFER",
      invoicePrefix: "BBS",
      recipientLabel: "Rechnung an:",
      transferPaymentTitle: "Zahlungsart: Ueberweisung",
      transferPaymentNotice: longTransferNotice,
      cashPaymentTitle: "Zahlungsart: Barzahlung",
      cashPaymentNote: "Der Betrag wurde in bar beglichen.",
      cardPaymentTitle: "Zahlungsart: Kartenzahlung",
      cardPaymentNote: "Der Betrag wurde per Kartenzahlung beglichen.",
      legalSmallBusinessNote: "Gemaess § 19 UStG wird keine Umsatzsteuer berechnet.",
      closingText,
      additionalFooterNote: "",
    },
  });
  expect(settingsResponse.ok()).toBeTruthy();

  try {
    const customerResponse = await request.post("/api/customers", {
      data: {
        name: `Layout Konsistenz Kundin ${unique}`,
        email: `layout-${unique}@bella-it.local`,
        phone: "01701231234",
        street: "Musterstrasse",
        houseNumber: "12",
        postalCode: "48153",
        city: "Muenster",
        country: "Deutschland",
        billingAddressEnabled: false,
        mediaConsent: false,
        status: "NEU",
        archived: false,
      },
    });
    expect(customerResponse.ok()).toBeTruthy();
    const customer = (await customerResponse.json()) as { id: string };

    const bankInvoiceResponse = await request.post("/api/invoices", {
      data: {
        customerId: customer.id,
        paymentMethod: "BANK_TRANSFER",
        items: [
          { name: "Refill", quantity: 2, priceCents: 12500 },
          { name: "Lash Shampoo", quantity: 3, priceCents: 3000 },
        ],
      },
    });
    expect(bankInvoiceResponse.ok()).toBeTruthy();
    const bankDraft = (await bankInvoiceResponse.json()) as {
      id: string;
      items: Array<{ service: string; quantity: number; unitPriceCents: number }>;
    };

    await page.goto(`/invoices/${bankDraft.id}/preview`, {
      waitUntil: "networkidle",
    });

    const invoiceDocument = page.getByTestId("invoice-document");
    await expect(invoiceDocument).toBeVisible();
    const logo = invoiceDocument.locator("img[alt='Bella by Sobiella Logo']").first();
    await expect(logo).toBeVisible();
    const ratioDiff = await logo.evaluate((element) => {
      const img = element as HTMLImageElement;
      const renderedRatio = img.clientWidth / img.clientHeight;
      const naturalRatio = img.naturalWidth / img.naturalHeight;
      return Math.abs(renderedRatio - naturalRatio);
    });
    expect(ratioDiff).toBeLessThan(0.05);

    await expect(invoiceDocument).toContainText(`Referenz ${shortRef}`);
    await expect(invoiceDocument).toContainText("Vielen Dank");
    await expect(invoiceDocument).not.toContainText(/Aktualisierter Abschlusstext/i);
    await expect(invoiceDocument).toContainText(/(Endbetrag|Gesamtbetrag)/);
    await expect(invoiceDocument).toContainText("Zahlungsart: Überweisung");

    const paymentBlock = page.getByTestId("invoice-payment-block");
    const paymentOverflows = await paymentBlock.locator("p").evaluateAll((nodes) =>
      nodes.some((node) => node.scrollWidth > node.clientWidth + 1),
    );
    expect(paymentOverflows).toBeFalsy();

    const iframe = page.locator("iframe[title^='Rechnung']").first();
    await expect(iframe).toBeVisible();
    const pdfUrl = await iframe.getAttribute("src");
    expect(pdfUrl).toBeTruthy();
    const pdfResponse = await request.get(pdfUrl as string);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

    const cashInvoiceResponse = await request.post("/api/invoices", {
      data: {
        customerId: customer.id,
        paymentMethod: "CASH",
        items: [{ name: "Produktverkauf", quantity: 1, priceCents: 9900 }],
      },
    });
    expect(cashInvoiceResponse.ok()).toBeTruthy();
    const cashDraft = (await cashInvoiceResponse.json()) as {
      id: string;
      items: Array<{ service: string; quantity: number; unitPriceCents: number }>;
    };
    await page.goto(`/invoices/${cashDraft.id}/preview`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("invoice-payment-block")).toContainText(
      "Zahlungsart: Barzahlung",
    );
  } finally {
    const restoreResponse = await request.put("/api/settings/invoice", {
      data: originalSettings,
    });
    expect(restoreResponse.ok()).toBeTruthy();
  }
});
