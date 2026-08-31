import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

type AppointmentStatus = "OFFEN" | "GEPLANT" | "ERLEDIGT" | "ABGERECHNET";

async function createCustomerViaApi(request: APIRequestContext, unique: string) {
  const response = await request.post("/api/customers", {
    headers: { "x-role": "ADMINISTRATORIN" },
    data: {
      name: `Kanban Kundin ${unique}`,
      email: `kanban-${unique}@example.com`,
      phone: "01701234567",
      notes: "E2E Testkundin fuer aktuelle Termin-Spalten",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; name: string };
}

async function createAppointmentViaApi(
  request: APIRequestContext,
  params: {
    customerId: string;
    service: string;
    status: AppointmentStatus;
    startsAt: string;
    priceCents: number;
  },
) {
  const response = await request.post("/api/appointments", {
    headers: { "x-role": "ADMINISTRATORIN" },
    data: {
      customerId: params.customerId,
      startsAt: params.startsAt,
      service: params.service,
      status: params.status,
      priceCents: params.priceCents,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string };
}

test("Appointments board: current columns and edit modal remain stable", async ({
  page,
  request,
}) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const customer = await createCustomerViaApi(request, unique);

  const now = Date.now();
  const inTwoHours = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const nextWeek = new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();

  await createAppointmentViaApi(request, {
    customerId: customer.id,
    service: `Diese Woche ${unique}`,
    status: "OFFEN",
    startsAt: inTwoHours,
    priceCents: 8500,
  });

  await createAppointmentViaApi(request, {
    customerId: customer.id,
    service: `Spaeter ${unique}`,
    status: "GEPLANT",
    startsAt: nextWeek,
    priceCents: 7900,
  });

  await createAppointmentViaApi(request, {
    customerId: customer.id,
    service: `Vergangen ${unique}`,
    status: "OFFEN",
    startsAt: twoHoursAgo,
    priceCents: 6900,
  });

  await page.goto("/appointments");
  await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible();
  await expect(page.getByTestId("appointments-kanban-board")).toBeVisible();

  const openColumn = page.getByTestId("kanban-column-offen");
  const thisWeekColumn = page.getByTestId("kanban-column-diese_woche");
  const pastColumn = page.getByTestId("kanban-column-vergangen");

  await expect(openColumn).toBeVisible();
  await expect(thisWeekColumn).toBeVisible();
  await expect(pastColumn).toBeVisible();
  await expect(page.getByTestId("kanban-column-count-offen")).toContainText("Termin");
  await expect(page.getByTestId("kanban-column-count-diese_woche")).toContainText("Termin");
  await expect(page.getByTestId("kanban-column-count-vergangen")).toContainText("Termin");

  await expect(openColumn.getByText(`Spaeter ${unique}`)).toBeVisible();
  await expect(thisWeekColumn.getByText(`Diese Woche ${unique}`)).toBeVisible();
  await expect(pastColumn.getByText(`Vergangen ${unique}`)).toBeVisible();

  const board = page.getByTestId("appointments-kanban-board");
  const overflowX = await board.evaluate((element) => window.getComputedStyle(element).overflowX);
  expect(overflowX === "auto" || overflowX === "scroll").toBeTruthy();

  const currentWeekCard = thisWeekColumn
    .locator("button")
    .filter({ hasText: customer.name })
    .filter({ hasText: `Diese Woche ${unique}` })
    .first();
  await expect(currentWeekCard).toBeVisible();
  await currentWeekCard.click();

  await expect(page.getByRole("heading", { name: "Termin-Detail" })).toBeVisible();
  await expect(page.getByText(`Diese Woche ${unique}`).last()).toBeVisible();
  await page.getByRole("button", { name: "Bearbeiten" }).click();

  await expect(page.getByRole("heading", { name: "Termin bearbeiten" })).toBeVisible();
  await page.getByLabel("Titel (optional)").fill(`Bearbeitet ${unique}`);
  await page.getByRole("button", { name: "Termin speichern" }).click();
  await expect(page.getByText("Termin aktualisiert.")).toBeVisible();
});
