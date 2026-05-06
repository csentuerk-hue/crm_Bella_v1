import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { reconcileAppointmentInvoiceConsistency } from "@/lib/data-consistency";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { appointmentStatusSchema } from "@/lib/validators";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function PATCH(
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

  const parsed = appointmentStatusSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsedParams.data.id },
    include: { invoice: { select: { id: true } } },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  }

  const hasInvoice = Boolean(appointment.invoice?.id);

  if (!hasInvoice && parsed.data.status === "ABGERECHNET") {
    return NextResponse.json(
      { error: "ABGERECHNET ist nur mit gespeicherter Rechnung erlaubt." },
      { status: 409 },
    );
  }

  if (hasInvoice && parsed.data.status !== "ABGERECHNET") {
    return NextResponse.json(
      { error: "Termin mit Rechnung bleibt auf ABGERECHNET." },
      { status: 409 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id: parsedParams.data.id },
    data: {
      status: hasInvoice ? "ABGERECHNET" : parsed.data.status,
      isCancelled: false,
      cancellationReason: null,
    },
    include: {
      customer: { select: { id: true, name: true } },
      invoice: { select: { id: true } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    customerName: updated.customer.name,
  });
}
