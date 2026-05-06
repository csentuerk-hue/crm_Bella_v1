import { expect, test, type APIRequestContext } from "@playwright/test";

type CustomerResponse = {
  id: string;
};

type InvoiceResponse = {
  id: string;
};

async function createCustomer(request: APIRequestContext, name: string) {
  const response = await request.post("/api/customers", {
    data: {
      name,
      mediaConsent: false,
      status: "NEU",
      archived: false,
      billingAddressEnabled: false,
    },
  });
  expect(response.ok()).toBeTruthy();
  const customer = (await response.json()) as CustomerResponse;
  expect(customer.id).toBeTruthy();
  return customer;
}

async function createDraftInvoice(
  request: APIRequestContext,
  customerId: string,
) {
  const response = await request.post("/api/invoices", {
    data: {
      customerId,
      items: [{ name: "Loeschschutz-Testposition", quantity: 1, priceCents: 2900 }],
    },
  });
  expect(response.ok()).toBeTruthy();
  const invoice = (await response.json()) as InvoiceResponse;
  expect(invoice.id).toBeTruthy();
  return invoice;
}

test("customer delete blocks linked invoices for normal and forced delete", async ({
  request,
}, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const protectedCustomer = await createCustomer(
    request,
    `Delete Schutz Kundin ${unique}`,
  );
  const protectedInvoice = await createDraftInvoice(request, protectedCustomer.id);

  const normalDelete = await request.delete(`/api/customers/${protectedCustomer.id}`);
  expect(normalDelete.status()).toBe(409);
  await expect(normalDelete.json()).resolves.toMatchObject({
    error: expect.stringContaining("Rechnungen"),
  });

  const forcedDeleteBlocked = await request.delete(`/api/customers/${protectedCustomer.id}`, {
    data: {
      forceDelete: true,
      confirmationCode: "54323",
      confirmPermanentDeletion: true,
    },
  });
  expect(forcedDeleteBlocked.status()).toBe(409);
  await expect(forcedDeleteBlocked.json()).resolves.toMatchObject({
    error: expect.stringContaining("Rechnungen"),
  });

  const invoiceStillExists = await request.get(`/api/invoices/${protectedInvoice.id}`);
  expect(invoiceStillExists.ok()).toBeTruthy();

  const customerStillExists = await request.get(`/api/customers/${protectedCustomer.id}`);
  expect(customerStillExists.ok()).toBeTruthy();

  const deleteDraftInvoice = await request.put(`/api/invoices/${protectedInvoice.id}`, {
    data: { deleteDraft: true },
  });
  expect(deleteDraftInvoice.ok()).toBeTruthy();

  const cleanupDeleteCustomer = await request.delete(`/api/customers/${protectedCustomer.id}`);
  expect(cleanupDeleteCustomer.ok()).toBeTruthy();
});

test("forced delete still works for customer without invoices", async ({ request }, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const deletableCustomer = await createCustomer(
    request,
    `Delete Frei Kundin ${unique}`,
  );

  const forcedDelete = await request.delete(`/api/customers/${deletableCustomer.id}`, {
    data: {
      forceDelete: true,
      confirmationCode: "54323",
      confirmPermanentDeletion: true,
    },
  });
  expect(forcedDelete.ok()).toBeTruthy();

  const deletedCustomerFetch = await request.get(`/api/customers/${deletableCustomer.id}`);
  expect(deletedCustomerFetch.status()).toBe(404);
});
