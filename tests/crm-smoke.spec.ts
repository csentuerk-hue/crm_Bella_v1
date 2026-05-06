import { expect, test } from "@playwright/test";

test("CRM flow: customer -> appointment -> invoice stays consistent after reload", async ({
  page,
  request,
}) => {
  const unique = Date.now().toString().slice(-6);
  const customerName = `Testkundin ${unique}`;
  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "Kundinnen" }).click();
  await expect(page.getByRole("heading", { name: "Kundinnen", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Neue Kundin" }).first().click();
  await page.getByLabel("Name (Pflichtfeld)").fill(customerName);
  await page.getByLabel("Telefonnummer").fill("01701234567");
  await page.getByLabel("E-Mail").fill(`kunde${unique}@example.com`);
  await page.getByLabel("Interne Notiz").fill("Erstellt durch Playwright-Test");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Kundin wurde angelegt.")).toBeVisible();

  await page.getByRole("link", { name: "Termine" }).click();
  await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible();

  await page.getByRole("button", { name: "Termin anlegen" }).click();
  await page.getByRole("button", { name: "Neuer Termin" }).click();
  const appointmentModal = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Neuer Termin" }) })
    .first();
  await appointmentModal.getByLabel("Kundin suchen").fill(customerName);
  await appointmentModal
    .locator("label:has-text('Kundin') select")
    .first()
    .selectOption({ label: customerName });
  await appointmentModal.getByLabel("Datum & Uhrzeit").fill(startsAt);
  await appointmentModal.getByLabel("Leistung").selectOption("1:1");
  await appointmentModal.getByLabel("Preis (EUR)").fill("89,00");
  await appointmentModal.getByLabel("Status").selectOption("ERLEDIGT");
  await page.getByRole("button", { name: "Termin speichern" }).click();
  await expect(page.getByText("Termin gespeichert.")).toBeVisible();

  const appointmentsAfterCreateResponse = await request.get(
    "/api/appointments?includeCancelled=true",
  );
  expect(appointmentsAfterCreateResponse.status()).toBe(200);
  const appointmentsAfterCreate = (await appointmentsAfterCreateResponse.json()) as Array<{
    id: string;
    customerId: string;
    customerName: string;
    status: string;
  }>;
  const createdAppointment = appointmentsAfterCreate.find(
    (item) => item.customerName === customerName,
  );
  expect(createdAppointment).toBeTruthy();
  if (!createdAppointment) {
    throw new Error("Erstellter Termin wurde nicht gefunden.");
  }

  const createInvoiceResponse = await request.post("/api/invoices", {
    data: {
      customerId: createdAppointment.customerId,
      appointmentId: createdAppointment.id,
      paymentMethod: "BANK_TRANSFER",
    },
  });
  expect(createInvoiceResponse.ok()).toBeTruthy();
  const createdInvoiceFromAppointment = (await createInvoiceResponse.json()) as {
    id: string;
    invoiceNumber: string | null;
    lifecycleStatus: string;
  };
  expect(createdInvoiceFromAppointment.id).toBeTruthy();
  expect(createdInvoiceFromAppointment.lifecycleStatus).toBe("ENTWURF");

  await page.getByRole("link", { name: "Rechnungen" }).click();
  await expect(page.getByRole("heading", { name: "Rechnung erstellen" })).toBeVisible();

  const invoicesResponse = await request.get("/api/invoices");
  expect(invoicesResponse.status()).toBe(200);
  const invoices = (await invoicesResponse.json()) as Array<{
    id: string;
    customerName: string;
    invoiceNumber: string | null;
    lifecycleStatus: string;
  }>;
  const createdInvoice = invoices.find((item) => item.customerName === customerName);
  expect(createdInvoice).toBeTruthy();
  if (!createdInvoice) {
    throw new Error("Erstellter Entwurf wurde nicht gefunden.");
  }
  expect(createdInvoice.id).toBeTruthy();
  expect(createdInvoice.lifecycleStatus).toBe("ENTWURF");

  const previewUrl = createdInvoice.invoiceNumber
    ? `/invoices/${createdInvoice.id}/preview?invoiceNumber=${encodeURIComponent(createdInvoice.invoiceNumber)}`
    : `/invoices/${createdInvoice.id}/preview`;
  await page.goto(previewUrl);
  await expect(page.getByRole("heading", { name: "Rechnungsvorschau" })).toBeVisible();
  await expect(page.getByText("Rechnung nicht gefunden.")).toHaveCount(0);
  if (createdInvoice.invoiceNumber) {
    await expect(page.getByText(createdInvoice.invoiceNumber)).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Rechnungsvorschau" })).toBeVisible();
  await expect(page.getByText("Rechnung nicht gefunden.")).toHaveCount(0);

  const appointmentsResponse = await request.get("/api/appointments?includeCancelled=true");
  expect(appointmentsResponse.status()).toBe(200);
  const appointments = (await appointmentsResponse.json()) as Array<{
    customerName: string;
    status: string;
    hasInvoice: boolean;
  }>;
  const appointment = appointments.find((item) => item.customerName === customerName);
  expect(appointment).toBeTruthy();
  expect(appointment?.status).toBe("ERLEDIGT");
  expect(appointment?.hasInvoice).toBeTruthy();
});
