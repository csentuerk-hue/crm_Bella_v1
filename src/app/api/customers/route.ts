import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverError, validationError } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toCustomerDTO } from "@/lib/serializers";
import { customerInputSchema } from "@/lib/validators";

const listQuerySchema = z.object({
  query: z.string().optional(),
  archived: z.enum(["true", "false"]).optional(),
});

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "customers:read");
  if (auth.denied) {
    return auth.denied;
  }

  try {
    await ensureDatabaseInitialized();

    const parsed = listQuerySchema.safeParse({
      query: request.nextUrl.searchParams.get("query") ?? undefined,
      archived: request.nextUrl.searchParams.get("archived") ?? undefined,
    });
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { query, archived } = parsed.data;
    const includeArchived = archived === "true";

    const customers = await prisma.customer.findMany({
      where: {
        archived: includeArchived ? undefined : false,
        OR: query
          ? [
              { name: { contains: query, mode: "insensitive" } },
              { displayName: { contains: query, mode: "insensitive" } },
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { customerNumber: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { notes: { contains: query, mode: "insensitive" } },
              { preferences: { contains: query, mode: "insensitive" } },
              { allergies: { contains: query, mode: "insensitive" } },
              { sensitivities: { contains: query, mode: "insensitive" } },
              { contraindications: { contains: query, mode: "insensitive" } },
              { tags: { contains: query, mode: "insensitive" } },
              { source: { contains: query, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: {
        appointments: {
          select: {
            id: true,
            startsAt: true,
            isCancelled: true,
            invoice: {
              select: { status: true },
            },
          },
        },
        treatmentEntries: { select: { id: true } },
      },
      orderBy: [{ archived: "asc" }, { updatedAt: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(customers.map((customer) => toCustomerDTO(customer)));
  } catch {
    return serverError("Kundinnen konnten nicht geladen werden.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, "customers:write");
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

    const parsed = customerInputSchema.safeParse(payload);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const customer = await prisma.customer.create({
      data: {
        customerNumber: parsed.data.customerNumber?.trim() || null,
        firstName: parsed.data.firstName?.trim() || null,
        lastName: parsed.data.lastName?.trim() || null,
        displayName: parsed.data.displayName?.trim() || null,
        name: parsed.data.name.trim(),
        email: parsed.data.email?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        birthday: parsed.data.birthday ? new Date(parsed.data.birthday) : null,
        preferences: parsed.data.preferences?.trim() || null,
        allergies: parsed.data.allergies?.trim() || null,
        sensitivities: parsed.data.sensitivities?.trim() || null,
        contraindications: parsed.data.contraindications?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        source: parsed.data.source?.trim() || null,
        tags: parsed.data.tags?.trim() || null,
        street: parsed.data.street?.trim() || null,
        houseNumber: parsed.data.houseNumber?.trim() || null,
        postalCode: parsed.data.postalCode?.trim() || null,
        city: parsed.data.city?.trim() || null,
        country: parsed.data.country?.trim() || "Deutschland",
        billingAddressEnabled: parsed.data.billingAddressEnabled ?? false,
        invoiceRecipientName: parsed.data.invoiceRecipientName?.trim() || null,
        invoiceRecipientAttention: parsed.data.invoiceRecipientAttention?.trim() || null,
        invoiceRecipientLine2: parsed.data.invoiceRecipientLine2?.trim() || null,
        invoiceStreet: parsed.data.invoiceStreet?.trim() || null,
        invoiceHouseNumber: parsed.data.invoiceHouseNumber?.trim() || null,
        invoicePostalCode: parsed.data.invoicePostalCode?.trim() || null,
        invoiceCity: parsed.data.invoiceCity?.trim() || null,
        invoiceCountry: parsed.data.invoiceCountry?.trim() || "Deutschland",
        invoiceEmail: parsed.data.invoiceEmail?.trim() || null,
        invoicePhone: parsed.data.invoicePhone?.trim() || null,
        invoiceNotes: parsed.data.invoiceNotes?.trim() || null,
        mediaConsent: parsed.data.mediaConsent ?? false,
        mediaConsentAt: parsed.data.mediaConsent ? new Date() : null,
        privacyConsent: parsed.data.privacyConsent ?? false,
        privacyConsentAt: parsed.data.privacyConsent ? new Date() : null,
        photoUrl: parsed.data.photoUrl?.trim() || null,
        status: parsed.data.status ?? "NEU",
        archived: parsed.data.archived ?? false,
      },
      include: {
        appointments: {
          select: {
            id: true,
            startsAt: true,
            isCancelled: true,
            invoice: {
              select: { status: true },
            },
          },
        },
        treatmentEntries: { select: { id: true } },
      },
    });

    return NextResponse.json(toCustomerDTO(customer), { status: 201 });
  } catch {
    return serverError("Kundin konnte nicht gespeichert werden.");
  }
}
