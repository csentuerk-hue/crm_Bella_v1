import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { reconcileAppointmentInvoiceConsistency } from "@/lib/data-consistency";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toAppointmentDTO } from "@/lib/serializers";
import { appointmentInputSchema } from "@/lib/validators";

const paramsSchema = z.object({ id: z.string().min(1) });

const updateSchema = appointmentInputSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "Mindestens ein Feld muss geaendert werden.",
);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "appointments:write");
  if (auth.denied) {
    return auth.denied;
  }
  await ensureDatabaseInitialized();
  await reconcileAppointmentInvoiceConsistency();

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationError(parsedParams.error);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsedParams.data.id },
    include: {
      customer: { select: { id: true, name: true, mediaConsent: true } },
      invoice: true,
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  }

  if (parsed.data.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: parsed.data.customerId },
    });
    if (!customer) {
      return NextResponse.json({ error: "Kundin nicht gefunden." }, { status: 404 });
    }
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

  const resolvedService =
    parsed.data.serviceId !== undefined
      ? parsed.data.serviceId
        ? parsed.data.serviceId
        : null
      : parsed.data.service
        ? (
            await prisma.service.findFirst({
              where: { name: parsed.data.service.trim(), isActive: true },
              select: { id: true },
            })
          )?.id
        : undefined;

  const hasInvoice = Boolean(appointment.invoice?.id);
  const changesProtectedFields =
    parsed.data.customerId !== undefined ||
    parsed.data.startsAt !== undefined ||
    parsed.data.service !== undefined ||
    parsed.data.priceCents !== undefined;

  if (hasInvoice && changesProtectedFields) {
    return NextResponse.json(
      { error: "Termin mit bestehender Rechnung kann nicht mehr in Kundin/Datum/Leistung/Preis geaendert werden." },
      { status: 409 },
    );
  }

  if (hasInvoice && parsed.data.isCancelled === true) {
    return NextResponse.json(
      { error: "Termin mit bestehender Rechnung kann nicht storniert werden." },
      { status: 409 },
    );
  }

  if (!hasInvoice && parsed.data.status === "ABGERECHNET") {
    return NextResponse.json(
      { error: "ABGERECHNET ist nur mit gespeicherter Rechnung erlaubt." },
      { status: 409 },
    );
  }

  if (hasInvoice && parsed.data.status && parsed.data.status !== "ABGERECHNET") {
    return NextResponse.json(
      { error: "Termin mit Rechnung bleibt auf ABGERECHNET." },
      { status: 409 },
    );
  }

  const nextIsCancelled = hasInvoice ? false : parsed.data.isCancelled;
  const nextCancellationReason =
    nextIsCancelled === true
      ? parsed.data.cancellationReason?.trim() || "Storniert"
      : null;

  const updated = await prisma.appointment.update({
    where: { id: parsedParams.data.id },
    data: {
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt:
        parsed.data.endsAt === undefined
          ? undefined
          : parsed.data.endsAt
            ? new Date(parsed.data.endsAt)
            : null,
      title: parsed.data.title?.trim(),
      serviceId: resolvedService,
      service: parsed.data.service?.trim(),
      status: hasInvoice ? "ABGERECHNET" : parsed.data.status,
      staffName: parsed.data.staffName?.trim(),
      roomLabel: parsed.data.roomLabel?.trim(),
      plannedPriceCents: parsed.data.plannedPriceCents,
      finalPriceCents: parsed.data.finalPriceCents,
      plannedPaymentMethod: parsed.data.plannedPaymentMethod,
      notes: parsed.data.notes?.trim(),
      priceCents: parsed.data.priceCents,
      customerId: parsed.data.customerId,
      isCancelled: nextIsCancelled,
      cancellationReason: nextCancellationReason,
    },
    include: {
      customer: { select: { id: true, name: true, mediaConsent: true } },
      invoice: { select: { id: true } },
    },
  });

  return NextResponse.json(toAppointmentDTO(updated));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "appointments:write");
  if (auth.denied) {
    return auth.denied;
  }
  await ensureDatabaseInitialized();

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationError(parsedParams.error);
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsedParams.data.id },
    include: { invoice: { select: { id: true } } },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  }

  if (appointment.invoice?.id) {
    return NextResponse.json(
      { error: "Termin mit Rechnung kann nicht gelöscht werden." },
      { status: 409 },
    );
  }

  await prisma.appointment.delete({ where: { id: parsedParams.data.id } });
  return NextResponse.json({ ok: true });
}
