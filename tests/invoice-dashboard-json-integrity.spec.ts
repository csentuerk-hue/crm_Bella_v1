import { expect, test } from "@playwright/test";

type InvoiceApiResponse = {
  id: string;
  invoiceNumber: string | null;
  lifecycleStatus: "ENTWURF" | "FINALISIERT";
  paymentMethod: "BANK_TRANSFER" | "CASH" | "CARD";
  paymentStatus: "OPEN" | "PAID";
  amountCents: number;
  subtotalCents: number;
  totalCents: number;
  transferPaymentNotice: string;
  bankIban: string;
  transferPaymentTitle: string;
  items: Array<{
    service: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  closingText: string;
  updatedAt: string;
};

test("invoice flows remain stable and JSON-safe", async ({ request }, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const customerName = `JSON Stabil Kundin ${unique}`;

  const customerResponse = await request.post("/api/customers", {
    data: {
      name: customerName,
      email: `json-${unique}@bella-it.local`,
      phone: "01701231234",
      street: "Musterstraße",
      houseNumber: "12",
      postalCode: "48153",
      city: "Münster",
      country: "Deutschland",
      billingAddressEnabled: true,
      invoiceRecipientName: "Studio Event UG",
      invoiceRecipientAttention: "z. Hd. Maria Beispiel",
      invoiceStreet: "Hammerstrasse",
      invoiceHouseNumber: "126",
      invoicePostalCode: "48153",
      invoiceCity: "Münster",
      invoiceCountry: "Deutschland",
      invoiceEmail: `rechnung-${unique}@bella-it.local`,
      mediaConsent: false,
      status: "NEU",
      archived: false,
    },
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customer = (await customerResponse.json()) as { id: string };

  const under250DraftResponse = await request.post("/api/invoices", {
    data: {
      customerId: customer.id,
      paymentMethod: "CASH",
      items: [{ name: "Lash Shampoo", quantity: 1, priceCents: 12000 }],
    },
  });
  expect(under250DraftResponse.ok()).toBeTruthy();
  const under250Draft = (await under250DraftResponse.json()) as InvoiceApiResponse;
  expect(under250Draft.invoiceNumber).toBeNull();
  expect(under250Draft.subtotalCents).toBe(12000);
  expect(under250Draft.totalCents).toBe(12000);
  expect(under250Draft.amountCents).toBe(12000);

  const under250FinalizeResponse = await request.put(
    `/api/invoices/${under250Draft.id}`,
    {
      data: {
        action: "FINALIZE",
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        items: under250Draft.items.map((item) => ({
          service: item.service,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      },
    },
  );
  expect(under250FinalizeResponse.ok()).toBeTruthy();
  const under250Finalized = (await under250FinalizeResponse.json()) as InvoiceApiResponse;
  expect(under250Finalized.invoiceNumber).toMatch(/^BBS-/);
  expect(under250Finalized.lifecycleStatus).toBe("FINALISIERT");
  expect(under250Finalized.paymentStatus).toBe("PAID");
  expect(under250Finalized.subtotalCents).toBe(12000);
  expect(under250Finalized.totalCents).toBe(12000);

  const over250DraftResponse = await request.post("/api/invoices", {
    data: {
      customerId: customer.id,
      paymentMethod: "BANK_TRANSFER",
      items: [{ name: "Premium Komplettpaket", quantity: 1, priceCents: 32000 }],
    },
  });
  expect(over250DraftResponse.ok()).toBeTruthy();
  const over250Draft = (await over250DraftResponse.json()) as InvoiceApiResponse;
  expect(over250Draft.invoiceNumber).toBeNull();
  expect(over250Draft.subtotalCents).toBe(32000);
  expect(over250Draft.totalCents).toBe(32000);

  const over250FinalizeBlocked = await request.put(`/api/invoices/${over250Draft.id}`, {
    data: {
      action: "FINALIZE",
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "OPEN",
      recipientName: "",
      recipientStreet: "",
      recipientHouseNumber: "",
      recipientZipCode: "",
      recipientCity: "",
      items: over250Draft.items.map((item) => ({
        service: item.service,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    },
  });
  expect(over250FinalizeBlocked.status()).toBe(422);
  const blockedPayload = (await over250FinalizeBlocked.json()) as { error: string };
  expect(blockedPayload.error).toContain("vollständige Kundenadresse");

  const over250FinalizeResponse = await request.put(`/api/invoices/${over250Draft.id}`, {
    data: {
      action: "FINALIZE",
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "OPEN",
      recipientName: "Studio Event UG",
      recipientAttention: "z. Hd. Maria Beispiel",
      recipientStreet: "Hammerstrasse",
      recipientHouseNumber: "126",
      recipientZipCode: "48153",
      recipientCity: "Münster",
      recipientCountry: "Deutschland",
      recipientEmail: `rechnung-${unique}@bella-it.local`,
      items: over250Draft.items.map((item) => ({
        service: item.service,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    },
  });
  expect(over250FinalizeResponse.ok()).toBeTruthy();
  const over250Finalized = (await over250FinalizeResponse.json()) as InvoiceApiResponse;
  expect(over250Finalized.invoiceNumber).toMatch(/^BBS-/);
  expect(over250Finalized.paymentMethod).toBe("BANK_TRANSFER");
  expect(over250Finalized.paymentStatus).toBe("OPEN");
  expect(over250Finalized.transferPaymentTitle.length).toBeGreaterThan(0);
  expect(over250Finalized.bankIban.length).toBeGreaterThan(0);
  expect(over250Finalized.transferPaymentNotice.length).toBeGreaterThan(0);
  expect(over250Finalized.transferPaymentTitle).not.toContain("-");
  expect(over250Finalized.bankIban).not.toContain("-");
  expect(over250Finalized.subtotalCents).toBe(32000);
  expect(over250Finalized.totalCents).toBe(32000);

  const over250MarkedPaidResponse = await request.put(`/api/invoices/${over250Finalized.id}`, {
    data: {
      paymentStatus: "PAID",
    },
  });
  expect(over250MarkedPaidResponse.ok()).toBeTruthy();
  const over250MarkedPaid = (await over250MarkedPaidResponse.json()) as InvoiceApiResponse;
  expect(over250MarkedPaid.paymentStatus).toBe("PAID");

  const multiLineDraftResponse = await request.post("/api/invoices", {
    data: {
      customerId: customer.id,
      paymentMethod: "BANK_TRANSFER",
      items: [
        { name: "Refill", quantity: 1, priceCents: 6500 },
        { name: "Lash Shampoo", quantity: 2, priceCents: 1200 },
      ],
    },
  });
  expect(multiLineDraftResponse.ok()).toBeTruthy();
  const multiLineDraft = (await multiLineDraftResponse.json()) as InvoiceApiResponse;
  expect(multiLineDraft.items.length).toBe(2);
  expect(multiLineDraft.invoiceNumber).toBeNull();
  expect(multiLineDraft.subtotalCents).toBe(8900);
  expect(multiLineDraft.totalCents).toBe(8900);

  const multiLineFinalizeResponse = await request.put(`/api/invoices/${multiLineDraft.id}`, {
    data: {
      action: "FINALIZE",
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "OPEN",
      items: multiLineDraft.items.map((item) => ({
        service: item.service,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    },
  });
  expect(multiLineFinalizeResponse.ok()).toBeTruthy();
  const multiLineFinalized = (await multiLineFinalizeResponse.json()) as InvoiceApiResponse;
  expect(multiLineFinalized.invoiceNumber).toMatch(/^BBS-/);
  expect(multiLineFinalized.subtotalCents).toBe(8900);
  expect(multiLineFinalized.totalCents).toBe(8900);

  const appointmentResponse = await request.post("/api/appointments", {
    data: {
      customerId: customer.id,
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      service: "Refill",
      priceCents: 4500,
      status: "ERLEDIGT",
      isCancelled: false,
      cancellationReason: null,
    },
  });
  expect(appointmentResponse.ok()).toBeTruthy();
  const appointment = (await appointmentResponse.json()) as { id: string };

  const fromAppointmentDraftResponse = await request.post("/api/invoices", {
    data: {
      customerId: customer.id,
      appointmentId: appointment.id,
      paymentMethod: "BANK_TRANSFER",
    },
  });
  expect(fromAppointmentDraftResponse.ok()).toBeTruthy();
  const fromAppointmentDraft = (await fromAppointmentDraftResponse.json()) as InvoiceApiResponse;
  expect(fromAppointmentDraft.invoiceNumber).toBeNull();

  const fromAppointmentFinalizeResponse = await request.put(
    `/api/invoices/${fromAppointmentDraft.id}`,
    {
      data: {
        action: "FINALIZE",
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "OPEN",
        items: fromAppointmentDraft.items.map((item) => ({
          service: item.service,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      },
    },
  );
  expect(fromAppointmentFinalizeResponse.ok()).toBeTruthy();
  const fromAppointmentFinalized = (await fromAppointmentFinalizeResponse.json()) as InvoiceApiResponse;
  expect(fromAppointmentFinalized.invoiceNumber).toMatch(/^BBS-/);
  expect(fromAppointmentFinalized.items[0]?.service).toBe("Refill");

  const updatedItems = fromAppointmentFinalized.items.map((item, index) => ({
    service: item.service,
    quantity: index === 0 ? item.quantity + 1 : item.quantity,
    unitPriceCents: item.unitPriceCents,
  }));
  const editFinalizedResponse = await request.put(
    `/api/invoices/${fromAppointmentFinalized.id}`,
    {
      data: {
        items: updatedItems,
      },
    },
  );
  expect(editFinalizedResponse.ok()).toBeTruthy();
  const editedFinalized = (await editFinalizedResponse.json()) as InvoiceApiResponse;
  expect(editedFinalized.lifecycleStatus).toBe("FINALISIERT");
  expect(editedFinalized.closingText.length).toBeGreaterThan(0);
  expect(editedFinalized.closingText).not.toMatch(/Aktualisierter Abschlusstext\\s+\\d+/i);
  expect(editedFinalized.subtotalCents).toBe(9000);
  expect(editedFinalized.totalCents).toBe(9000);

  const reloadedInvoiceResponse = await request.get(
    `/api/invoices/${fromAppointmentFinalized.id}?invoiceNumber=${encodeURIComponent(
      fromAppointmentFinalized.invoiceNumber ?? "",
    )}`,
  );
  expect(reloadedInvoiceResponse.ok()).toBeTruthy();
  const reloadedInvoice = (await reloadedInvoiceResponse.json()) as InvoiceApiResponse;
  expect(reloadedInvoice.closingText.length).toBeGreaterThan(0);
  expect(reloadedInvoice.closingText).not.toMatch(/Aktualisierter Abschlusstext\\s+\\d+/i);
  expect(reloadedInvoice.subtotalCents).toBe(9000);
  expect(reloadedInvoice.totalCents).toBe(9000);

  const pdfResponse = await request.get(
    `/api/invoices/${fromAppointmentFinalized.id}/pdf?invoiceNumber=${encodeURIComponent(
      fromAppointmentFinalized.invoiceNumber ?? "",
    )}`,
  );
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
});

test("dashboard loads without JSON parse runtime error", async ({ page, request }) => {
  const dashboardApi = await request.get("/api/dashboard");
  expect(dashboardApi.ok()).toBeTruthy();
  expect(dashboardApi.headers()["content-type"]).toContain("application/json");
  const dashboardPayload = (await dashboardApi.json()) as { metrics?: unknown };
  expect(dashboardPayload.metrics).toBeTruthy();

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

  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-planning-grid")).toBeVisible();

  expect(
    pageErrors.some((entry) => entry.includes("Unexpected end of JSON input")),
  ).toBeFalsy();
  expect(
    consoleErrors.some((entry) => entry.includes("Unexpected end of JSON input")),
  ).toBeFalsy();
});
