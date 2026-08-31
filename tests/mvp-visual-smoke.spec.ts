import fs from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

const OUTPUT_DIR = "artifacts/mvp-visual";

type InvoiceDTO = {
  id: string;
  invoiceNumber: string | null;
  lifecycleStatus: "ENTWURF" | "FINALISIERT";
  documentStatus: "DRAFT" | "FINAL" | "SENT" | "CANCELLED";
  paymentMethod: "BANK_TRANSFER" | "CASH" | "CARD";
  paymentStatus: "OPEN" | "PAID";
  items: Array<{ service: string; quantity: number; unitPriceCents: number }>;
};

async function createCustomer(request: APIRequestContext, unique: string) {
  const response = await request.post("/api/customers", {
    data: {
      name: `Visual Test Kundin ${unique}`,
      email: `visual-${unique}@test.local`,
      mediaConsent: false,
      status: "NEU",
      archived: false,
      billingAddressEnabled: false,
    },
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

async function createInvoice(request: APIRequestContext, customerId: string, method: "CASH" | "CARD") {
  const response = await request.post("/api/invoices", {
    data: {
      customerId,
      paymentMethod: method,
      items: [{ name: "Visual Testleistung", quantity: 1, priceCents: 5000 }],
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as InvoiceDTO;
}

test("invoice workspace and archive are visually usable on desktop and tablet", async ({ page, request }, testInfo) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const unique = `${Date.now()}-${testInfo.workerIndex}`;
  const customerId = await createCustomer(request, unique);

  const cardDraft = await createInvoice(request, customerId, "CARD");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/invoices?invoiceId=${encodeURIComponent(cardDraft.id)}`);
  await expect(page.getByLabel("Zahlungsart").last()).toHaveValue("CARD");
  await page.screenshot({ path: `${OUTPUT_DIR}/invoice-card-draft-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.reload();
  await expect(page.getByLabel("Zahlungsart").last()).toHaveValue("CARD");
  await page.screenshot({ path: `${OUTPUT_DIR}/invoice-card-draft-tablet.png`, fullPage: true });

  const cashDraft = await createInvoice(request, customerId, "CASH");
  const finalizeResponse = await request.put(`/api/invoices/${cashDraft.id}`, {
    data: {
      action: "FINALIZE",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      recipientName: `Visual Test Kundin ${unique}`,
      items: cashDraft.items.map((item) => ({
        service: item.service,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    },
  });
  expect(finalizeResponse.ok()).toBeTruthy();
  const finalized = (await finalizeResponse.json()) as InvoiceDTO;
  expect(finalized.lifecycleStatus).toBe("FINALISIERT");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/invoices?invoiceId=${encodeURIComponent(finalized.id)}`);
  await expect(page.getByText("Diese Rechnung ist finalisiert und kann nicht mehr bearbeitet werden.").last()).toBeVisible();
  await page.screenshot({ path: `${OUTPUT_DIR}/invoice-finalized-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.reload();
  await expect(page.getByText("Diese Rechnung ist finalisiert und kann nicht mehr bearbeitet werden.").last()).toBeVisible();
  await page.screenshot({ path: `${OUTPUT_DIR}/invoice-finalized-tablet.png`, fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/invoices/archive");
  await expect(page.getByText(finalized.invoiceNumber ?? "", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ansehen" }).first()).toBeVisible();
  await page.screenshot({ path: `${OUTPUT_DIR}/invoice-archive-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.reload();
  await expect(page.getByRole("link", { name: "Ansehen" }).first()).toBeVisible();
  await page.screenshot({ path: `${OUTPUT_DIR}/invoice-archive-tablet.png`, fullPage: true });
});
