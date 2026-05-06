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
      notes: "E2E Testkundin fuer Kanban-Spalten",
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

test("Appointments board: columns, sums, drag-drop and edit modal remain stable", async ({
  page,
  request,
}) => {
  const unique = Date.now().toString().slice(-6);
  const customer = await createCustomerViaApi(request, unique);

  const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

  const openAppointment = await createAppointmentViaApi(request, {
    customerId: customer.id,
    service: `Kanban Offen ${unique}`,
    status: "OFFEN",
    startsAt: inTwoHours,
    priceCents: 8500,
  });

  await createAppointmentViaApi(request, {
    customerId: customer.id,
    service: `Kanban Geplant ${unique}`,
    status: "GEPLANT",
    startsAt: inThreeHours,
    priceCents: 7900,
  });

  await page.goto("/appointments?view=kanban");
  await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible();
  await expect(page.getByTestId("appointments-kanban-board")).toBeVisible();

  await expect(page.getByTestId("kanban-column-offen")).toBeVisible();
  await expect(page.getByTestId("kanban-column-geplant")).toBeVisible();
  await expect(page.getByTestId("kanban-column-erledigt")).toBeVisible();
  await expect(page.getByTestId("kanban-column-abgerechnet")).toBeVisible();
  await expect(page.getByTestId("kanban-column-storniert")).toBeVisible();

  await expect(page.getByTestId("kanban-column-count-offen")).toContainText("Termin");
  await expect(page.getByTestId("kanban-column-sum-offen")).toContainText("€");
  await expect(page.getByTestId("kanban-column-sum-geplant")).toContainText("€");

  const board = page.getByTestId("appointments-kanban-board");
  const overflowX = await board.evaluate((element) => window.getComputedStyle(element).overflowX);
  expect(overflowX === "auto" || overflowX === "scroll").toBeTruthy();

  const dragSource = page
    .getByTestId("kanban-column-offen")
    .locator("button")
    .filter({ hasText: `Kanban Offen ${unique}` })
    .first();
  const dropTarget = page.getByTestId("kanban-column-geplant");
  await dragSource.dispatchEvent("dragstart");
  await dropTarget.dispatchEvent("dragover");
  await dropTarget.dispatchEvent("drop");
  await dragSource.dispatchEvent("dragend");

  await expect
    .poll(async () => {
      const appointmentsAfterDrop = await request.get("/api/appointments?includeCancelled=true", {
        headers: { "x-role": "ADMINISTRATORIN" },
      });
      if (appointmentsAfterDrop.status() !== 200) return "REQUEST_FAILED";
      const appointmentPayload = (await appointmentsAfterDrop.json()) as Array<{ id: string; status: string }>;
      const moved = appointmentPayload.find((appointment) => appointment.id === openAppointment.id);
      return moved?.status ?? "NOT_FOUND";
    })
    .toBe("GEPLANT");

  const movedCard = page
    .getByTestId("kanban-column-geplant")
    .locator("button")
    .filter({ hasText: customer.name })
    .filter({ hasText: `Kanban Offen ${unique}` })
    .first();
  await expect(movedCard).toBeVisible();
  await movedCard.click();

  await page.getByRole("button", { name: "Bearbeiten" }).click();
  await expect(page.getByRole("heading", { name: "Termin bearbeiten" })).toBeVisible();
  await page.getByLabel("Leistung").fill(`Kanban Offen edited ${unique}`);
  await page.getByRole("button", { name: "Termin speichern" }).click();
  await expect(page.getByText("Termin aktualisiert.")).toBeVisible();
});
