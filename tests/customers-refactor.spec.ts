import { expect, test } from "@playwright/test";

test("Customers workspace: selection, profile updates and media consent persist", async ({ page, request }) => {
  const unique = Date.now().toString().slice(-6);
  const customerName = `UI Kundin ${unique}`;

  const createResponse = await request.post("/api/customers", {
    headers: { "x-role": "ADMINISTRATORIN" },
    data: {
      name: customerName,
      phone: "01709998877",
      email: `ui-${unique}@example.com`,
      notes: "Kommt alle 3 Wochen.",
      mediaConsent: false,
    },
  });
  expect(createResponse.status()).toBe(201);

  await page.goto("/customers");
  await expect(page.getByTestId("customers-crm-layout")).toBeVisible();
  await expect(page.getByTestId("customers-list-column")).toBeVisible();
  await expect(page.getByTestId("customers-main-column")).toBeVisible();

  await page.getByPlaceholder("Suche nach Name").fill(unique);
  const listColumn = page.getByTestId("customers-list-column");
  const row = listColumn.getByRole("button", { name: new RegExp(customerName) }).first();
  await expect(row).toBeVisible();
  await row.click();

  const mainColumn = page.getByTestId("customers-main-column");
  await expect(mainColumn.getByText(customerName).first()).toBeVisible();
  await expect(mainColumn.getByRole("heading", { name: "Interne Notiz" })).toBeVisible();

  const birthdayInput = mainColumn.getByRole("textbox", { name: "Geburtstag" });
  await birthdayInput.fill("1992-06-15");
  await mainColumn.getByRole("button", { name: "Profil speichern" }).click();
  await expect(page.getByText("Profil gespeichert.")).toBeVisible();

  await mainColumn.getByRole("button", { name: "Medienfreigabe" }).first().click();
  const mediaModal = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Medienfreigabe" }) })
    .first();
  await expect(mediaModal).toBeVisible();
  await mediaModal.getByLabel("Ja").check();
  await mediaModal.getByRole("button", { name: "Speichern" }).click();
  await expect(mediaModal).toBeHidden();

  const customerListResponse = await request.get(`/api/customers?query=${encodeURIComponent(unique)}&archived=true`, {
    headers: { "x-role": "ADMINISTRATORIN" },
  });
  expect(customerListResponse.status()).toBe(200);
  const customerList = (await customerListResponse.json()) as Array<{
    name: string;
    mediaConsent: boolean;
  }>;
  const updatedCustomer = customerList.find((customer) => customer.name === customerName);
  expect(updatedCustomer).toBeTruthy();
  expect(updatedCustomer?.mediaConsent).toBeTruthy();

  await page.reload();
  await page.getByPlaceholder("Suche nach Name").fill(unique);
  await listColumn.getByRole("button", { name: new RegExp(customerName) }).first().click();
  await expect(mainColumn.getByText(customerName).first()).toBeVisible();
});
