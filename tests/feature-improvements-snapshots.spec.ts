import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("capture screenshots for weekly calendar, service select, cancellation warning and delete flow", async ({
  page,
  request,
}) => {
  const timestamp = Date.now();
  const warningCustomerName = `Warnkundin ${timestamp}`;
  const deletableCustomerName = `Loeschkundin ${timestamp}`;

  const warningCustomerResponse = await request.post("/api/customers", {
    data: {
      name: warningCustomerName,
      phone: null,
      email: null,
      birthday: null,
      preferences: null,
      allergies: null,
      notes: null,
      photoUrl: null,
      status: "NEU",
      archived: false,
      mediaConsent: false,
    },
  });
  expect(warningCustomerResponse.ok()).toBeTruthy();
  const warningCustomer = (await warningCustomerResponse.json()) as { id: string };

  const today = new Date();
  for (let i = 0; i < 2; i += 1) {
    const startsAt = new Date(today.getTime() + i * 60 * 60 * 1000).toISOString();
    const appointmentResponse = await request.post("/api/appointments", {
      data: {
        customerId: warningCustomer.id,
        startsAt,
        service: "Refill",
        priceCents: 5900,
        status: "OFFEN",
        isCancelled: true,
        cancellationReason: "Test-Storno",
      },
    });
    expect(appointmentResponse.ok()).toBeTruthy();
  }

  const deletableCustomerResponse = await request.post("/api/customers", {
    data: {
      name: deletableCustomerName,
      phone: null,
      email: null,
      birthday: null,
      preferences: null,
      allergies: null,
      notes: null,
      photoUrl: null,
      status: "NEU",
      archived: false,
      mediaConsent: false,
    },
  });
  expect(deletableCustomerResponse.ok()).toBeTruthy();

  const shotsDir = path.resolve(process.cwd(), "screenshots");
  fs.mkdirSync(shotsDir, { recursive: true });

  await page.setViewportSize({ width: 1680, height: 1000 });

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(shotsDir, "dashboard-weekly-calendar.png"),
    fullPage: true,
  });

  await page.goto("/appointments");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Termin anlegen" }).click();
  const appointmentModal = page.locator("section", {
    has: page.getByRole("heading", { name: "Neuen Termin anlegen" }),
  });
  await expect(appointmentModal).toBeVisible();
  await appointmentModal.getByLabel("Kundin suchen").fill(warningCustomerName);
  await appointmentModal.getByLabel("KundinBitte").selectOption({
    label: warningCustomerName,
  });
  await page.screenshot({
    path: path.join(shotsDir, "appointment-create-service-select.png"),
    fullPage: true,
  });

  await appointmentModal.getByRole("button", { name: "Termin speichern" }).click();
  await expect(page.getByRole("heading", { name: "Storno-Warnung" })).toBeVisible();
  await page.screenshot({
    path: path.join(shotsDir, "appointment-cancellation-warning.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abbrechen" }).first().click();
  await appointmentModal.getByRole("button", { name: "Schliessen" }).click();

  await page.goto("/customers");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Suche nach Name").fill(deletableCustomerName);
  const customerRow = page.locator('[data-testid="customers-list-column"] button', {
    hasText: deletableCustomerName,
  });
  await expect(customerRow).toBeVisible();
  await customerRow.click();
  await page.getByRole("button", { name: "Kundin loeschen" }).click();
  await expect(page.getByRole("heading", { name: "Kundin dauerhaft loeschen" })).toBeVisible();
  await page.screenshot({
    path: path.join(shotsDir, "customer-delete-flow.png"),
    fullPage: true,
  });
});
