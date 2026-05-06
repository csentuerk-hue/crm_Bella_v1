import { expect, test } from "@playwright/test";

type InvoiceResponse = {
  id: string;
  invoiceNumber: string | null;
};

type CleanupCandidate = {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  amountCents: number;
  reasons: string[];
};

type CleanupReport = {
  actionLabel: string;
  requiredConfirmation: string;
  candidates: CleanupCandidate[];
  skipped: Array<{
    id: string;
    invoiceNumber: string;
    recipientName: string;
    amountCents: number;
    reason: string;
  }>;
  deletedInvoices?: number;
  deletedInvoiceNumbers?: string[];
};

test("invoice-only cleanup detects test invoices and keeps real invoices", async ({ request }) => {
  const unique = Date.now().toString();

  const realCustomerResponse = await request.post("/api/customers", {
    data: {
      name: `Real Kundin ${unique}`,
      email: `real-${unique}@bella-studio.de`,
      phone: "01701234567",
      archived: false,
      mediaConsent: false,
      billingAddressEnabled: false,
    },
  });
  expect(realCustomerResponse.ok()).toBeTruthy();
  const realCustomer = (await realCustomerResponse.json()) as { id: string };

  const testCustomerResponse = await request.post("/api/customers", {
    data: {
      name: `Test Kundin ${unique}`,
      email: `test-${unique}@example.com`,
      phone: "01707654321",
      archived: false,
      mediaConsent: false,
      billingAddressEnabled: false,
    },
  });
  expect(testCustomerResponse.ok()).toBeTruthy();
  const testCustomer = (await testCustomerResponse.json()) as { id: string };

  const linkedTestInvoiceResponse = await request.post("/api/invoices", {
    data: {
      customerId: testCustomer.id,
      paymentMethod: "BANK_TRANSFER",
      items: [{ name: "Refill", quantity: 1, priceCents: 4500 }],
    },
  });
  expect(linkedTestInvoiceResponse.ok()).toBeTruthy();
  const linkedTestInvoice = (await linkedTestInvoiceResponse.json()) as InvoiceResponse;

  const standaloneTestInvoiceResponse = await request.post("/api/invoices", {
    data: {
      customerId: testCustomer.id,
      paymentMethod: "CASH",
      items: [{ name: "Testleistung", quantity: 1, priceCents: 1200 }],
      closingText: `Aktualisierter Abschlusstext (${unique})`,
    },
  });
  expect(standaloneTestInvoiceResponse.ok()).toBeTruthy();
  const standaloneTestInvoice =
    (await standaloneTestInvoiceResponse.json()) as InvoiceResponse;

  const realInvoiceResponse = await request.post("/api/invoices", {
    data: {
      customerId: realCustomer.id,
      paymentMethod: "CASH",
      items: [{ name: "Refill", quantity: 1, priceCents: 4900 }],
    },
  });
  expect(realInvoiceResponse.ok()).toBeTruthy();
  const realInvoice = (await realInvoiceResponse.json()) as InvoiceResponse;

  const dryRunResponse = await request.get("/api/invoices/test-cleanup");
  expect(dryRunResponse.ok()).toBeTruthy();
  const dryRun = (await dryRunResponse.json()) as CleanupReport;

  expect(dryRun.actionLabel).toBe("Nur Testrechnungen bereinigen");
  expect(dryRun.requiredConfirmation).toBe("DELETE TEST INVOICES");

  const candidateIds = dryRun.candidates.map((candidate) => candidate.id);
  expect(candidateIds).toContain(linkedTestInvoice.id);
  expect(candidateIds).toContain(standaloneTestInvoice.id);
  expect(candidateIds).not.toContain(realInvoice.id);

  const linkedCandidate = dryRun.candidates.find(
    (candidate) => candidate.id === linkedTestInvoice.id,
  );
  expect(linkedCandidate).toBeTruthy();
  expect((linkedCandidate?.reasons ?? []).length).toBeGreaterThan(0);

  const standaloneCandidate = dryRun.candidates.find(
    (candidate) => candidate.id === standaloneTestInvoice.id,
  );
  expect(standaloneCandidate).toBeTruthy();
  expect((standaloneCandidate?.reasons ?? []).length).toBeGreaterThan(0);

  const rejectedExecuteResponse = await request.post("/api/invoices/test-cleanup", {
    data: { confirmation: "DELETE" },
  });
  expect(rejectedExecuteResponse.status()).toBe(400);

  const executeResponse = await request.post("/api/invoices/test-cleanup", {
    data: { confirmation: dryRun.requiredConfirmation },
  });
  expect(executeResponse.ok()).toBeTruthy();
  const executeResult = (await executeResponse.json()) as CleanupReport;

  expect(executeResult.deletedInvoices ?? 0).toBeGreaterThanOrEqual(2);
  expect(executeResult.deletedInvoiceNumbers?.length ?? 0).toBeGreaterThan(0);

  const linkedAfterDelete = await request.get(`/api/invoices/${linkedTestInvoice.id}`);
  expect(linkedAfterDelete.status()).toBe(404);

  const standaloneAfterDelete = await request.get(
    `/api/invoices/${standaloneTestInvoice.id}`,
  );
  expect(standaloneAfterDelete.status()).toBe(404);

  const realAfterDelete = await request.get(`/api/invoices/${realInvoice.id}`);
  expect(realAfterDelete.ok()).toBeTruthy();

  const testCustomerAfterDelete = await request.get(`/api/customers/${testCustomer.id}`);
  expect(testCustomerAfterDelete.ok()).toBeTruthy();
});
