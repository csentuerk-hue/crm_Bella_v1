import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("capture service color refinement in appointments and dashboard indicators", async ({
  page,
  request,
}) => {
  const unique = Date.now().toString();
  const customerName = `Service Farben ${unique}`;

  const customerResponse = await request.post("/api/customers", {
    data: {
      name: customerName,
      phone: "01705556666",
      email: null,
      birthday: null,
      preferences: null,
      allergies: null,
      notes: "Snapshot seed for service colors",
      photoUrl: null,
      status: "AKTIV",
      archived: false,
      mediaConsent: true,
    },
  });
  expect(customerResponse.ok()).toBeTruthy();
  const customer = (await customerResponse.json()) as { id: string };

  const now = new Date();
  const services = ["Refill", "Neuset 1:1", "Volumenset"];
  for (let i = 0; i < services.length; i += 1) {
    const startsAt = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000).toISOString();
    const appointmentResponse = await request.post("/api/appointments", {
      data: {
        customerId: customer.id,
        startsAt,
        service: services[i],
        priceCents: 5900 + i * 1000,
        status: "OFFEN",
        isCancelled: false,
        cancellationReason: null,
      },
    });
    expect(appointmentResponse.ok()).toBeTruthy();
  }

  const shotsDir = path.resolve(process.cwd(), "screenshots");
  fs.mkdirSync(shotsDir, { recursive: true });

  await page.setViewportSize({ width: 1680, height: 1000 });

  await page.goto("/appointments");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Suche nach Kundin, Leistung oder Status").fill(customerName);
  await expect(page.getByText(customerName).first()).toBeVisible();
  await page.screenshot({
    path: path.join(shotsDir, "appointments-service-colors-refined.png"),
    fullPage: true,
  });

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(shotsDir, "dashboard-service-indicators-refined.png"),
    fullPage: true,
  });
});
