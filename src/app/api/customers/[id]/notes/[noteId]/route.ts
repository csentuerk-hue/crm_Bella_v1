import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toCustomerNoteDTO } from "@/lib/serializers";
import { customerNoteInputSchema } from "@/lib/validators";

const paramsSchema = z.object({
  id: z.string().min(1),
  noteId: z.string().min(1),
});

const updateSchema = customerNoteInputSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "Mindestens ein Feld muss geaendert werden.",
);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
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

  const existing = await prisma.customerNote.findFirst({
    where: {
      id: parsedParams.data.noteId,
      customerId: parsedParams.data.id,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Notiz nicht gefunden." }, { status: 404 });
  }

  const updated = await prisma.customerNote.update({
    where: { id: parsedParams.data.noteId },
    data: {
      noteType: parsed.data.noteType,
      title: parsed.data.title === undefined ? undefined : parsed.data.title?.trim() || null,
      content: parsed.data.content?.trim(),
    },
  });

  return NextResponse.json(toCustomerNoteDTO(updated));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
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

  const existing = await prisma.customerNote.findFirst({
    where: {
      id: parsedParams.data.noteId,
      customerId: parsedParams.data.id,
    },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Notiz nicht gefunden." }, { status: 404 });
  }

  await prisma.customerNote.delete({ where: { id: parsedParams.data.noteId } });
  return NextResponse.json({ ok: true });
}

