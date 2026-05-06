import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverError, validationError } from "@/lib/api";
import { reconcileAppointmentInvoiceConsistency } from "@/lib/data-consistency";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toAppointmentDTO } from "@/lib/serializers";
import { appointmentInputSchema } from "@/lib/validators";
import { APPOINTMENT_STATUS } from "@/types/crm";

const listQuerySchema = z.object({
  status: z.enum(APPOINTMENT_STATUS).optional(),
  includeCancelled: z.enum(["true", "false"]).optional(),
  customerId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "appointments:read");
  if (auth.denied) {
    return auth.denied;
  }

  try {
    await ensureDatabaseInitialized();
    await reconcileAppointmentInvoiceConsistency();

    const parsed = listQuerySchema.safeParse({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      includeCancelled:
        request.nextUrl.searchParams.get("includeCancelled") ?? undefined,
      customerId: request.nextUrl.searchParams.get("customerId") ?? undefined,
    });
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        status: parsed.data.status,
        customerId: parsed.data.customerId,
        isCancelled:
          parsed.data.includeCancelled === "true" ? undefined : false,
      },
      include: {
        customer: { select: { id: true, name: true, mediaConsent: true } },
        invoice: { select: { id: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json(appointments.map((item) => toAppointmentDTO(item)));
  } catch {
    return serverError("Termine konnten nicht geladen werden.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, "appointments:write");
  if (auth.denied) {
    return auth.denied;
  }

  try {
    await ensureDatabaseInitialized();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    const parsed = appointmentInputSchema.safeParse(payload);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    if (parsed.data.status === "ABGERECHNET") {
      return NextResponse.json(
        { error: "Ein Termin kann nur mit gespeicherter Rechnung auf ABGERECHNET stehen." },
        { status: 409 },
      );
    }

    if (parsed.data.serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: parsed.data.serviceId },
        select: { id: true },
      });
      if (!service) {
        return NextResponse.json({ error: "Leistung nicht gefunden." }, { status: 404 });
      }
    }

    const customer = await prisma.customer.findUnique({
      where: { id: parsed.data.customerId },
    });
    if (!customer) {
      return NextResponse.json({ error: "Kundin nicht gefunden." }, { status: 404 });
    }

    const resolvedService =
      parsed.data.serviceId
        ? await prisma.service.findUnique({
            where: { id: parsed.data.serviceId },
            select: { id: true, name: true },
          })
        : await prisma.service.findFirst({
            where: { name: parsed.data.service.trim(), isActive: true },
            select: { id: true, name: true },
          });

    const appointment = await prisma.appointment.create({
      data: {
        title: parsed.data.title?.trim() || null,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        serviceId: resolvedService?.id ?? parsed.data.serviceId ?? null,
        service: parsed.data.service.trim(),
        status: parsed.data.status ?? "OFFEN",
        staffName: parsed.data.staffName?.trim() || null,
        roomLabel: parsed.data.roomLabel?.trim() || null,
        plannedPriceCents: parsed.data.plannedPriceCents ?? null,
        finalPriceCents: parsed.data.finalPriceCents ?? null,
        plannedPaymentMethod: parsed.data.plannedPaymentMethod ?? null,
        notes: parsed.data.notes?.trim() || null,
        priceCents: parsed.data.priceCents,
        customerId: parsed.data.customerId,
        isCancelled: parsed.data.isCancelled ?? false,
        cancellationReason: parsed.data.cancellationReason?.trim() || null,
      },
      include: {
        customer: { select: { id: true, name: true, mediaConsent: true } },
        invoice: { select: { id: true } },
      },
    });

    return NextResponse.json(toAppointmentDTO(appointment), { status: 201 });
  } catch {
    return serverError("Termin konnte nicht gespeichert werden.");
  }
}
