import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toCustomerNoteDTO } from "@/lib/serializers";
import { customerNoteInputSchema } from "@/lib/validators";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const listQuerySchema = z.object({
  noteType: z.enum(["GENERAL", "APPOINTMENT", "INVOICE", "CARE", "WARNING"]).optional(),
});

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

  const parsedQuery = listQuerySchema.safeParse({
    noteType: request.nextUrl.searchParams.get("noteType") ?? undefined,
  });
  if (!parsedQuery.success) {
    return validationError(parsedQuery.error);
  }

  const notes = await prisma.customerNote.findMany({
    where: {
      customerId: parsedParams.data.id,
      noteType: parsedQuery.data.noteType,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(notes.map((note) => toCustomerNoteDTO(note)));
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

  const parsed = customerNoteInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const note = await prisma.customerNote.create({
    data: {
      customerId: parsedParams.data.id,
      noteType: parsed.data.noteType ?? "GENERAL",
      title: parsed.data.title?.trim() || null,
      content: parsed.data.content.trim(),
    },
  });

  return NextResponse.json(toCustomerNoteDTO(note), { status: 201 });
}

