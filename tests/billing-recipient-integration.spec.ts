import { expect, test } from "@playwright/test";

test("Settings flow: invoice settings load, save and persist", async ({ page }) => {
  const marker = Date.now().toString().slice(-6);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Einstellungen > Rechnung" })).toBeVisible();

  const closingTextField = page.getByLabel("Abschlusstext");
  const originalValue = await closingTextField.inputValue();
  const updatedValue = `${originalValue} [PW-${marker}]`;

  await closingTextField.fill(updatedValue);
  await page.getByRole("button", { name: "Rechnungseinstellungen speichern" }).click();
  await expect(page.getByText("Rechnungseinstellungen gespeichert.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Abschlusstext")).toHaveValue(updatedValue);

  await page.getByLabel("Abschlusstext").fill(originalValue);
  await page.getByRole("button", { name: "Rechnungseinstellungen speichern" }).click();
  await expect(page.getByText("Rechnungseinstellungen gespeichert.")).toBeVisible();
});

test("Integration flow: customer billing address -> appointment -> invoice snapshot", async ({
  page,
  request,
}, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const customerName = `Rechnungslauf ${unique}`;
  const recipientName = `Studio Event UG ${unique}`;
  const street = "Hammer Strasse";
  const houseNumber = "126";
  const postalCode = "48153";
  const city = "Muenster";
  const recipientEmail = `invoice-${unique}@bella-it.local`;
  const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);

  await page.goto("/customers");
  await expect(page.getByRole("heading", { name: "Kundinnen", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Neue Kundin" }).first().click();
  await page.getByLabel("Name (Pflichtfeld)").fill(customerName);
  await page.getByLabel("Telefonnummer").fill("01701234567");
  await page.getByLabel("E-Mail").fill(`kunde-${unique}@bella-it.local`);
  await page.getByLabel("Straße").fill("Beispielweg");
  await page.getByLabel("Hausnummer").fill("5");
  await page.getByLabel("PLZ").fill("48155");
  await page.getByLabel("Ort").fill("Muenster");
  await page
    .getByLabel("Abweichende Rechnungsadresse verwenden")
    .check();
  await page.getByLabel("Rechnungsempfängername (Pflicht)").fill(recipientName);
  await page.getByLabel("Rechnungsstraße (Pflicht)").fill(street);
  await page.getByLabel("Rechnungshausnummer (Pflicht)").fill(houseNumber);
  await page.getByLabel("Rechnungs-PLZ (Pflicht)").fill(postalCode);
  await page.getByLabel("Rechnungsort (Pflicht)").fill(city);
  await page.getByLabel("Rechnungs-E-Mail").fill(recipientEmail);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Kundin wurde angelegt.")).toBeVisible();

  await page.goto("/appointments");
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

  await page.goto("/customers");
  await page.getByPlaceholder("Suche nach Name").fill(customerName);
  await page
    .locator("button")
    .filter({ hasText: customerName })
    .first()
    .click();

  await expect(page.getByRole("button", { name: "Rechnung erstellen" })).toBeEnabled();
  await page.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(page.getByText(/Rechnung .* erstellt\./)).toBeVisible();

  const customersResponse = await request.get(`/api/customers?query=${encodeURIComponent(customerName)}`);
  expect(customersResponse.status()).toBe(200);
  const customers = (await customersResponse.json()) as Array<{ id: string; name: string }>;
  const createdCustomer = customers.find((item) => item.name === customerName);
  expect(createdCustomer).toBeTruthy();

  const invoicesResponse = await request.get(
    `/api/invoices?customerId=${encodeURIComponent(createdCustomer!.id)}`,
  );
  expect(invoicesResponse.status()).toBe(200);
  const invoices = (await invoicesResponse.json()) as Array<{
    id: string;
    invoiceNumber: string | null;
    recipientName: string;
    recipientStreet: string;
    recipientHouseNumber: string;
    recipientZipCode: string;
    recipientCity: string;
    recipientEmail: string;
  }>;
  const createdInvoice = invoices[0];
  expect(createdInvoice).toBeTruthy();
  expect(createdInvoice.recipientName).toBe(recipientName);
  expect(createdInvoice.recipientStreet).toBe(street);
  expect(createdInvoice.recipientHouseNumber).toBe(houseNumber);
  expect(createdInvoice.recipientZipCode).toBe(postalCode);
  expect(createdInvoice.recipientCity).toBe(city);
  expect(createdInvoice.recipientEmail).toBe(recipientEmail);

  const previewPath = createdInvoice.invoiceNumber
    ? `/invoices/${createdInvoice.id}/preview?invoiceNumber=${encodeURIComponent(createdInvoice.invoiceNumber)}`
    : `/invoices/${createdInvoice.id}/preview`;
  await page.goto(previewPath);
  await expect(page.getByRole("heading", { name: "Rechnungsvorschau" })).toBeVisible();
  await expect(page.getByText(recipientName)).toBeVisible();
  await expect(page.getByText(`${street} ${houseNumber}`)).toBeVisible();
  await expect(page.getByText(`${postalCode} ${city}`)).toBeVisible();
  await expect(page.getByText(/^Zahlungsart$/)).toBeVisible();
});
