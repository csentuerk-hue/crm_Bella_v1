import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toPaymentDTO } from "@/lib/serializers";
import { paymentInputSchema } from "@/lib/validators";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "invoices:read");
  if (auth.denied) {
    return auth.denied;
  }

  await ensureDatabaseInitialized();

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationError(parsedParams.error);
  }

  const payments = await prisma.payment.findMany({
    where: { invoiceId: parsedParams.data.id },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(payments.map((payment) => toPaymentDTO(payment)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "invoices:write");
  if (auth.denied) {
    return auth.denied;
  }

  await ensureDatabaseInitialized();

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationError(parsedParams.error);
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: parsedParams.data.id },
    select: { id: true, totalCents: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Rechnung nicht gefunden." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = paymentInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: parsedParams.data.id,
      method: parsed.data.method,
      status: parsed.data.status ?? "OPEN",
      amountCents: parsed.data.amountCents,
      paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : null,
      reference: parsed.data.reference?.trim() || null,
      note: parsed.data.note?.trim() || null,
    },
  });

  const totalPaid = await prisma.payment.aggregate({
    where: {
      invoiceId: parsedParams.data.id,
      status: "PAID",
    },
    _sum: { amountCents: true },
  });

  const paidAmount = totalPaid._sum.amountCents ?? 0;
  const nextPaymentStatus =
    paidAmount <= 0
      ? "OPEN"
      : paidAmount < invoice.totalCents
        ? "PARTIALLY_PAID"
        : "PAID";

  await prisma.invoice.update({
    where: { id: parsedParams.data.id },
    data: {
      paymentStatus: nextPaymentStatus,
      paymentDate: nextPaymentStatus === "PAID" ? new Date() : null,
      status: nextPaymentStatus === "PAID" ? "BEZAHLT" : "OFFEN",
    },
  });

  return NextResponse.json(toPaymentDTO(payment), { status: 201 });
}

