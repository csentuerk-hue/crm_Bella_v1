import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toServiceDTO } from "@/lib/serializers";
import { serviceInputSchema } from "@/lib/validators";

const paramsSchema = z.object({ id: z.string().min(1) });

const updateSchema = serviceInputSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "Mindestens ein Feld muss geaendert werden.",
);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "services:write");
  if (auth.denied) {
    return auth.denied;
  }

  await ensureDatabaseInitialized();

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

  const existing = await prisma.service.findUnique({ where: { id: parsedParams.data.id } });
  if (!existing) {
    return NextResponse.json({ error: "Leistung nicht gefunden." }, { status: 404 });
  }

  const updated = await prisma.service.update({
    where: { id: parsedParams.data.id },
    data: {
      name: parsed.data.name?.trim(),
      category: parsed.data.category === undefined ? undefined : parsed.data.category?.trim() || null,
      description:
        parsed.data.description === undefined ? undefined : parsed.data.description?.trim() || null,
      defaultPriceCents: parsed.data.defaultPriceCents,
      durationMinutes: parsed.data.durationMinutes,
      isActive: parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
    },
  });

  return NextResponse.json(toServiceDTO(updated));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "services:write");
  if (auth.denied) {
    return auth.denied;
  }

  await ensureDatabaseInitialized();

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationError(parsedParams.error);
  }

  const usageCount = await prisma.appointment.count({
    where: { serviceId: parsedParams.data.id },
  });

  if (usageCount > 0) {
    return NextResponse.json(
      {
        error:
          "Leistung ist bereits mit Terminen verknuepft. Bitte erst deaktivieren statt löschen.",
      },
      { status: 409 },
    );
  }

  await prisma.service.delete({ where: { id: parsedParams.data.id } });
  return NextResponse.json({ ok: true });
}

