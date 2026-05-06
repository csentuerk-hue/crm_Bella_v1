import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toCustomerDTO } from "@/lib/serializers";
import { customerInputSchema } from "@/lib/validators";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const forcedDeleteSchema = z.object({
  forceDelete: z.boolean().optional(),
  confirmationCode: z.string().optional(),
  confirmPermanentDeletion: z.boolean().optional(),
});

const FORCED_DELETE_CODE = "54323";
const INVOICE_DELETE_BLOCK_MESSAGE =
  "Kundin kann nicht dauerhaft geloescht werden, weil verknuepfte Rechnungen vorhanden sind.";

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

  const customer = await prisma.customer.findUnique({
    where: { id: parsedParams.data.id },
    include: {
      appointments: {
        select: {
          id: true,
          startsAt: true,
          isCancelled: true,
          invoice: { select: { status: true } },
        },
      },
      treatmentEntries: { select: { id: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Kundin nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(toCustomerDTO(customer));
}

export async function PUT(
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

  const existing = await prisma.customer.findUnique({
    where: { id: parsedParams.data.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Kundin nicht gefunden." }, { status: 404 });
  }

  const updated = await prisma.customer.update({
    where: { id: parsedParams.data.id },
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
      country: parsed.data.country?.trim() || existing.country || "Deutschland",
      billingAddressEnabled:
        parsed.data.billingAddressEnabled ?? existing.billingAddressEnabled,
      invoiceRecipientName: parsed.data.invoiceRecipientName?.trim() || null,
      invoiceRecipientAttention: parsed.data.invoiceRecipientAttention?.trim() || null,
      invoiceRecipientLine2: parsed.data.invoiceRecipientLine2?.trim() || null,
      invoiceStreet: parsed.data.invoiceStreet?.trim() || null,
      invoiceHouseNumber: parsed.data.invoiceHouseNumber?.trim() || null,
      invoicePostalCode: parsed.data.invoicePostalCode?.trim() || null,
      invoiceCity: parsed.data.invoiceCity?.trim() || null,
      invoiceCountry:
        parsed.data.invoiceCountry?.trim() || existing.invoiceCountry || "Deutschland",
      invoiceEmail: parsed.data.invoiceEmail?.trim() || null,
      invoicePhone: parsed.data.invoicePhone?.trim() || null,
      invoiceNotes: parsed.data.invoiceNotes?.trim() || null,
      mediaConsent: parsed.data.mediaConsent ?? existing.mediaConsent,
      mediaConsentAt:
        parsed.data.mediaConsent === undefined
          ? existing.mediaConsentAt
          : parsed.data.mediaConsent
            ? existing.mediaConsentAt ?? new Date()
            : null,
      privacyConsent: parsed.data.privacyConsent ?? existing.privacyConsent,
      privacyConsentAt:
        parsed.data.privacyConsent === undefined
          ? existing.privacyConsentAt
          : parsed.data.privacyConsent
            ? existing.privacyConsentAt ?? new Date()
            : null,
      photoUrl: parsed.data.photoUrl?.trim() || null,
      status: parsed.data.status ?? existing.status,
      archived: parsed.data.archived ?? existing.archived,
    },
    include: {
      appointments: {
        select: {
          id: true,
          startsAt: true,
          isCancelled: true,
          invoice: { select: { status: true } },
        },
      },
      treatmentEntries: { select: { id: true } },
    },
  });

  return NextResponse.json(toCustomerDTO(updated));
}

export async function DELETE(
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = undefined;
  }

  const parsedDeletePayload = forcedDeleteSchema.safeParse(payload ?? {});
  if (!parsedDeletePayload.success) {
    return validationError(parsedDeletePayload.error);
  }

  const isForcedDelete = parsedDeletePayload.data.forceDelete === true;

  const customer = await prisma.customer.findUnique({
    where: { id: parsedParams.data.id },
    include: {
      appointments: {
        select: {
          id: true,
        },
      },
      invoices: {
        select: { id: true },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Kundin nicht gefunden." }, { status: 404 });
  }

  const invoiceLinkedCount = customer.invoices.length;

  if (isForcedDelete) {
    const hasValidCode =
      parsedDeletePayload.data.confirmationCode?.trim() === FORCED_DELETE_CODE;
    const acknowledged = parsedDeletePayload.data.confirmPermanentDeletion === true;

    if (!hasValidCode || !acknowledged) {
      return NextResponse.json(
        {
          error:
            "Forced Delete gesperrt: Bitte Code 54323 eingeben und die endgültige Löschung bestätigen.",
        },
        { status: 400 },
      );
    }

    if (invoiceLinkedCount > 0) {
      return NextResponse.json({ error: INVOICE_DELETE_BLOCK_MESSAGE }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const deletedAppointments = await tx.appointment.deleteMany({
        where: { customerId: parsedParams.data.id },
      });

      const deletedTreatmentEntries = await tx.treatmentEntry.deleteMany({
        where: { customerId: parsedParams.data.id },
      });

      const deletedCustomerNotes = await tx.customerNote.deleteMany({
        where: { customerId: parsedParams.data.id },
      });

      await tx.customer.delete({
        where: { id: parsedParams.data.id },
      });

      return {
        deletedAppointments: deletedAppointments.count,
        deletedTreatmentEntries: deletedTreatmentEntries.count,
        deletedCustomerNotes: deletedCustomerNotes.count,
      };
    });

    return NextResponse.json({
      ok: true,
      mode: "forced",
      deletedCustomerId: parsedParams.data.id,
      deletedAppointments: result.deletedAppointments,
      deletedTreatmentEntries: result.deletedTreatmentEntries,
      deletedCustomerNotes: result.deletedCustomerNotes,
    });
  }

  if (invoiceLinkedCount > 0) {
    return NextResponse.json({ error: INVOICE_DELETE_BLOCK_MESSAGE }, { status: 409 });
  }

  if (customer.appointments.length > 0) {
    return NextResponse.json(
      {
        error:
          "Kundin kann wegen vorhandener Termine nicht gelöscht werden. Termine zuerst loesen oder entfernen.",
      },
      { status: 409 },
    );
  }

  await prisma.customer.delete({ where: { id: parsedParams.data.id } });
  return NextResponse.json({ ok: true });
}
