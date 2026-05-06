import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toTreatmentEntryDTO } from "@/lib/serializers";
import { treatmentEntryInputSchema } from "@/lib/validators";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "customers:read");
  if (auth.denied) {
    return auth.denied;
  }
  await ensureDatabaseInitialized();

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationError(parsedParams.error);
  }

  const treatments = await prisma.treatmentEntry.findMany({
    where: { customerId: parsedParams.data.id },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(treatments.map(toTreatmentEntryDTO));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "customers:write");
  if (auth.denied) {
    return auth.denied;
  }
  await ensureDatabaseInitialized();

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationError(parsedParams.error);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: parsedParams.data.id },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Kundin nicht gefunden." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = treatmentEntryInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const created = await prisma.treatmentEntry.create({
    data: {
      customerId: parsedParams.data.id,
      performedAt: new Date(parsed.data.performedAt),
      treatment: parsed.data.treatment.trim(),
      style: parsed.data.style?.trim() || null,
      technique: parsed.data.technique?.trim() || null,
      length: parsed.data.length?.trim() || null,
      note: parsed.data.note?.trim() || null,
    },
  });

  return NextResponse.json(toTreatmentEntryDTO(created), { status: 201 });
}
