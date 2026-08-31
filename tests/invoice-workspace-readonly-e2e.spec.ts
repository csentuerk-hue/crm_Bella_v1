import { expect, test, type APIRequestContext } from "@playwright/test";

type CreatedInvoice = {
  id: string;
  invoiceNumber: string | null;
  lifecycleStatus: "ENTWURF" | "FINALISIERT";
  paymentMethod: "BANK_TRANSFER" | "CASH" | "CARD";
  items: Array<{
    service: string;
    quantity: number;
    unitPriceCents: number;
  }>;
};

async function createTestCustomer(request: APIRequestContext, unique: string) {
  const response = await request.post("/api/customers", {
    data: {
      name: `MVP Test Kundin ${unique}`,
      email: `mvp-test-${unique}@test.local`,
      mediaConsent: false,
      status: "NEU",
      archived: false,
      billingAddressEnabled: false,
    },
  });
  expect(response.ok()).toBeTruthy();
  const customer = (await response.json()) as { id: string };
  expect(customer.id).toBeTruthy();
  return customer.id;
}

async function createFreeInvoice(
  request: APIRequestContext,
  customerId: string,
  paymentMethod: "BANK_TRANSFER" | "CASH" | "CARD",
) {
  const response = await request.post("/api/invoices", {
    data: {
      customerId,
      paymentMethod,
      items: [
        {
          name: "Testleistung",
          quantity: 1,
          priceCents: 5000,
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as CreatedInvoice;
}

test("finalisierte Rechnung ist im echten Workspace schreibgeschützt", async ({
  page,
  request,
}, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const customerId = await createTestCustomer(request, unique);
  const draft = await createFreeInvoice(request, customerId, "CASH");

  const finalizeResponse = await request.put(`/api/invoices/${draft.id}`, {
    data: {
      action: "FINALIZE",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      recipientName: `MVP Test Kundin ${unique}`,
      items: draft.items.map((item) => ({
        service: item.service,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    },
  });
  expect(finalizeResponse.ok()).toBeTruthy();
  const finalized = (await finalizeResponse.json()) as CreatedInvoice;
  expect(finalized.lifecycleStatus).toBe("FINALISIERT");
  expect(finalized.invoiceNumber).toMatch(/^BBS-/);

  await page.goto(`/invoices?invoiceId=${encodeURIComponent(finalized.id)}`);

  const lockMessage = page
    .getByText("Diese Rechnung ist finalisiert und kann nicht mehr bearbeitet werden.")
    .last();
  await expect(lockMessage).toBeVisible();

  const editor = lockMessage.locator("xpath=..");
  await expect(editor.getByLabel("Kundin")).toBeDisabled();
  await expect(editor.getByLabel("Zahlungsart")).toBeDisabled();
  await expect(editor.getByLabel("Zahlungsstatus")).toBeDisabled();
  await expect(editor.getByRole("button", { name: "Entwurf speichern" })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Finalisieren" })).toHaveCount(0);
  await expect(editor.getByRole("link", { name: "Vorschau" })).toBeVisible();
  await expect(editor.getByRole("link", { name: "PDF herunterladen" })).toBeVisible();
  await expect(editor.getByRole("link", { name: "Zum Archiv" })).toBeVisible();
});

test("Kartenzahlung bleibt beim Öffnen eines Entwurfs erhalten", async ({
  page,
  request,
}, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const customerId = await createTestCustomer(request, unique);
  const draft = await createFreeInvoice(request, customerId, "CARD");
  expect(draft.paymentMethod).toBe("CARD");

  await page.goto(`/invoices?invoiceId=${encodeURIComponent(draft.id)}`);

  const editorHeading = page.getByRole("heading", { name: "Entwurf", exact: true }).last();
  await expect(editorHeading).toBeVisible();
  const editorSection = editorHeading.locator("xpath=ancestor::section[1]");
  const paymentMethod = editorSection.getByLabel("Zahlungsart");

  await expect(paymentMethod).toHaveValue("CARD");
  await expect(paymentMethod.locator("option[value='CARD']")).toHaveText("Kartenzahlung");
});
