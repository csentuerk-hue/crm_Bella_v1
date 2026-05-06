import { expect, test } from "@playwright/test";

test("Customers: edit, archive and unarchive through real API-backed flow", async ({
  page,
  request,
}) => {
  const unique = Date.now().toString().slice(-7);
  const customerName = `Archiv Test ${unique}`;

  const createResponse = await request.post("/api/customers", {
    headers: { "x-role": "ADMINISTRATORIN" },
    data: {
      name: customerName,
      phone: "01700001111",
      email: `archive-${unique}@example.com`,
      notes: "E2E Archiv-Test",
    },
  });
  expect(createResponse.status()).toBe(201);

  await page.goto("/customers");
  await page.getByPlaceholder("Suche nach Name").fill(unique);

  const listColumn = page.getByTestId("customers-list-column");
  const entryButton = listColumn.getByRole("button", { name: new RegExp(customerName) }).first();
  await expect(entryButton).toBeVisible();
  await entryButton.click();

  const mainColumn = page.getByTestId("customers-main-column");
  await expect(mainColumn.getByText(customerName).first()).toBeVisible();

  const phoneInput = mainColumn.getByRole("textbox", { name: "Telefon" });
  await phoneInput.fill("01701234567");
  await mainColumn.getByRole("button", { name: "Profil speichern" }).click();
  await expect(page.getByText("Profil gespeichert.")).toBeVisible();
  await expect(phoneInput).toHaveValue("01701234567");

  await mainColumn.getByRole("button", { name: "Archivieren" }).click();
  await expect(page.getByText("Profil gespeichert.")).toBeVisible();
  await expect(listColumn).not.toContainText(customerName);

  await page.getByLabel("Archivierte anzeigen").check();
  await page.getByPlaceholder("Suche nach Name").fill(unique);
  const archivedEntry = listColumn.getByRole("button", { name: new RegExp(customerName) }).first();
  await expect(archivedEntry).toBeVisible();
  await archivedEntry.click();
  await mainColumn.getByRole("button", { name: "Archiv aufheben" }).click();
  await expect(page.getByText("Profil gespeichert.")).toBeVisible();

  await page.getByLabel("Archivierte anzeigen").uncheck();
  await page.getByPlaceholder("Suche nach Name").fill(unique);
  await expect(listColumn.getByRole("button", { name: new RegExp(customerName) }).first()).toBeVisible();
});
