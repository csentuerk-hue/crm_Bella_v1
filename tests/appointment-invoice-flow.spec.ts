import { expect, test } from "@playwright/test";

test("appointment based invoice flow still works", async ({ request }, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;

  const customerResponse = await request.post("/api/customers", {
    data: {
      name: `Terminrechnung Kundin ${unique}`,
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

  const appointmentResponse = await request.post("/api/appointments", {
    data: {
      customerId,
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      service: "Refill",
      priceCents: 4500,
      status: "ERLEDIGT",
      isCancelled: false,
      cancellationReason: null,
    },
  });
  expect(appointmentResponse.ok()).toBeTruthy();
  const appointment = await appointmentResponse.json();
  const appointmentId = appointment.id as string;
  expect(appointmentId).toBeTruthy();

  const invoiceResponse = await request.post("/api/invoices", {
    data: {
      customerId,
      appointmentId,
      paymentMethod: "CASH",
    },
  });
  expect(invoiceResponse.ok()).toBeTruthy();
  const invoice = await invoiceResponse.json();

  expect(invoice.customerId).toBe(customerId);
  expect(invoice.appointmentId).toBe(appointmentId);
  expect(invoice.items.length).toBeGreaterThan(0);
  expect(invoice.invoiceNumber).toBeNull();
  expect(invoice.lifecycleStatus).toBe("ENTWURF");
  expect(invoice.paymentMethod).toBe("CASH");
  expect(invoice.paymentStatus).toBe("PAID");

  const finalizeResponse = await request.put(`/api/invoices/${invoice.id}`, {
    data: {
      action: "FINALIZE",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      recipientName: `Terminrechnung Kundin ${unique}`,
      recipientStreet: "Musterstraße",
      recipientHouseNumber: "1",
      recipientZipCode: "12345",
      recipientCity: "Musterstadt",
      items: invoice.items.map((item: { service: string; quantity: number; unitPriceCents: number }) => ({
        service: item.service,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    },
  });
  expect(finalizeResponse.ok()).toBeTruthy();
  const finalized = await finalizeResponse.json();
  expect(finalized.invoiceNumber).toMatch(/^BBS-/);
  expect(finalized.lifecycleStatus).toBe("FINALISIERT");

  const pdfResponse = await request.get(
    `/api/invoices/${invoice.id}/pdf?invoiceNumber=${encodeURIComponent(finalized.invoiceNumber)}`,
  );
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
});
