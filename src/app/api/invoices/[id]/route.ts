import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { serverError, validationError } from "@/lib/api";
import { reconcileAppointmentInvoiceConsistency } from "@/lib/data-consistency";
import {
  deriveCustomerInitials,
  formatInvoiceNumber,
} from "@/lib/invoice-number";
import { resolveInvoiceByIdentifier } from "@/lib/invoice-query";
import {
  defaultPaymentStatusByMethod,
  validateInvoiceFinalizationData,
} from "@/lib/invoice-rules";
import { getOrCreateInvoiceSettings } from "@/lib/invoice-settings";
import { applyInvoiceSettingsFallback } from "@/lib/invoice-view";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toInvoiceDTO } from "@/lib/serializers";
import { invoiceUpdateSchema } from "@/lib/validators";

const paramsSchema = z.object({ id: z.string().min(1) });
const FINALIZED_DOCUMENT_STATUSES = new Set(["FINAL", "SENT", "CANCELLED"] as const);

const invoiceInclude = {
  items: true,
  customer: {
    select: {
      id: true,
      name: true,
      customerNumber: true,
      email: true,
      phone: true,
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
      country: true,
      billingAddressEnabled: true,
      invoiceRecipientName: true,
      invoiceRecipientAttention: true,
      invoiceRecipientLine2: true,
      invoiceStreet: true,
      invoiceHouseNumber: true,
      invoicePostalCode: true,
      invoiceCity: true,
      invoiceCountry: true,
      invoiceEmail: true,
      invoicePhone: true,
      invoiceNotes: true,
    },
  },
  appointment: {
    select: {
      id: true,
      startsAt: true,
      service: true,
      customer: { select: { name: true } },
    },
  },
} as const;

type EditableCustomerSnapshot = {
  id: string;
  name: string;
  customerNumber: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  billingAddressEnabled: boolean;
  invoiceRecipientName: string | null;
  invoiceRecipientAttention: string | null;
  invoiceRecipientLine2: string | null;
  invoiceStreet: string | null;
  invoiceHouseNumber: string | null;
  invoicePostalCode: string | null;
  invoiceCity: string | null;
  invoiceCountry: string;
  invoiceEmail: string | null;
  invoicePhone: string | null;
  invoiceNotes: string | null;
};

function isInvoiceNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== "P2002") {
    return false;
  }

  const rawTarget = error.meta?.target;
  const targets = Array.isArray(rawTarget)
    ? rawTarget.map((value) => String(value))
    : rawTarget
      ? [String(rawTarget)]
      : [];

  return targets.some(
    (value) => value.includes("invoiceNumber") || value.includes("sequence"),
  );
}

function toLegacyInvoiceStatus(paymentStatus: "OPEN" | "PAID"): "OFFEN" | "BEZAHLT" {
  return paymentStatus === "PAID" ? "BEZAHLT" : "OFFEN";
}

function recipientFromCustomer(customer: EditableCustomerSnapshot) {
  if (customer.billingAddressEnabled) {
    return {
      recipientName: customer.invoiceRecipientName?.trim() || customer.name,
      recipientAttention: customer.invoiceRecipientAttention?.trim() || "",
      recipientLine2: customer.invoiceRecipientLine2?.trim() || "",
      recipientStreet: customer.invoiceStreet?.trim() || "",
      recipientHouseNumber: customer.invoiceHouseNumber?.trim() || "",
      recipientZipCode: customer.invoicePostalCode?.trim() || "",
      recipientCity: customer.invoiceCity?.trim() || "",
      recipientCountry: customer.invoiceCountry?.trim() || "Deutschland",
      recipientEmail: customer.invoiceEmail?.trim() || "",
      recipientPhone: customer.invoicePhone?.trim() || "",
      recipientNotes: customer.invoiceNotes?.trim() || "",
    };
  }
  return {
    recipientName: customer.name,
    recipientAttention: "",
    recipientLine2: "",
    recipientStreet: customer.street?.trim() || "",
    recipientHouseNumber: customer.houseNumber?.trim() || "",
    recipientZipCode: customer.postalCode?.trim() || "",
    recipientCity: customer.city?.trim() || "",
    recipientCountry: customer.country?.trim() || "Deutschland",
    recipientEmail: customer.email?.trim() || "",
    recipientPhone: customer.phone?.trim() || "",
    recipientNotes: "",
  };
}

function mapUpdateError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "INVOICE_NOT_FOUND") {
    return { status: 404, error: "Rechnung nicht gefunden." };
  }
  if (message === "CUSTOMER_NOT_FOUND") {
    return { status: 404, error: "Kundin wurde nicht gefunden." };
  }
  if (message === "CUSTOMER_REQUIRED") {
    return { status: 422, error: "Bitte eine Kundin auswählen." };
  }
  if (message === "DELETE_ONLY_DRAFT") {
    return {
      status: 409,
      error: "Nur Entwürfe können gelöscht werden.",
    };
  }
  if (message.startsWith("FINALIZE_BLOCKED:")) {
    return {
      status: 422,
      error: message.replace("FINALIZE_BLOCKED:", "").replaceAll(" | ", "\n"),
    };
  }
  if (message === "INVOICE_FINALIZED_LOCKED") {
    return {
      status: 409,
      error:
        "Finalisierte Rechnungen können inhaltlich nicht mehr geändert werden. Nur der Zahlungsstatus darf angepasst werden.",
    };
  }
  if (isInvoiceNumberConflict(error)) {
    return {
      status: 409,
      error: "Rechnung wird gerade parallel finalisiert. Bitte erneut versuchen.",
    };
  }

  return {
    status: 500,
    error: "Rechnung konnte nicht aktualisiert werden.",
  };
}

function normalizeComparableText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isFinalizedInvoiceState(input: {
  lifecycleStatus: string;
  documentStatus: string;
}): boolean {
  return (
    input.lifecycleStatus === "FINALISIERT" ||
    FINALIZED_DOCUMENT_STATUSES.has(
      input.documentStatus as "FINAL" | "SENT" | "CANCELLED",
    )
  );
}

function isSameDateTime(
  existingDate: Date | null,
  incomingDateIso: string | null | undefined,
): boolean {
  if (incomingDateIso === undefined) {
    return true;
  }
  if (incomingDateIso === null) {
    return existingDate === null;
  }
  const incomingDate = new Date(incomingDateIso);
  if (Number.isNaN(incomingDate.getTime())) {
    return false;
  }
  if (!existingDate) {
    return false;
  }
  return existingDate.getTime() === incomingDate.getTime();
}

function hasLockedLineItemChanges(
  existingItems: Array<{
    service: string;
    quantity: number;
    unitPriceCents: number;
  }>,
  incomingItems: Array<{
    service: string;
    quantity: number;
    unitPriceCents: number;
  }>,
): boolean {
  if (existingItems.length !== incomingItems.length) {
    return true;
  }

  return existingItems.some((existingItem, index) => {
    const incomingItem = incomingItems[index];
    if (!incomingItem) {
      return true;
    }
    return (
      normalizeComparableText(existingItem.service) !==
        normalizeComparableText(incomingItem.service) ||
      existingItem.quantity !== incomingItem.quantity ||
      existingItem.unitPriceCents !== incomingItem.unitPriceCents
    );
  });
}

function hasLockedFinalizedContentChanges(
  invoice: {
    customerId: string | null;
    appointmentId: string | null;
    issueDate: Date;
    serviceDate: Date | null;
    paymentMethod: string;
    smallBusinessEnabled: boolean;
    legalSmallBusinessNote: string;
    closingText: string;
    additionalFooterNote: string;
    recipientName: string;
    recipientAttention: string;
    recipientLine2: string;
    recipientStreet: string;
    recipientHouseNumber: string;
    recipientZipCode: string;
    recipientCity: string;
    recipientCountry: string;
    recipientEmail: string;
    recipientPhone: string;
    recipientNotes: string;
    invoiceNumber: string | null;
    sequence: number | null;
    items: Array<{
      service: string;
      quantity: number;
      unitPriceCents: number;
    }>;
  },
  update: z.infer<typeof invoiceUpdateSchema>,
): boolean {
  if (update.action !== undefined) return true;
  if (update.customerId !== undefined && update.customerId !== invoice.customerId) return true;
  if (update.paymentMethod !== undefined && update.paymentMethod !== invoice.paymentMethod) return true;
  if (!isSameDateTime(invoice.issueDate, update.issueDate)) return true;
  if (!isSameDateTime(invoice.serviceDate, update.serviceDate)) return true;
  if (
    update.recipientName !== undefined &&
    normalizeComparableText(update.recipientName) !== normalizeComparableText(invoice.recipientName)
  ) {
    return true;
  }
  if (
    update.recipientAttention !== undefined &&
    normalizeComparableText(update.recipientAttention) !==
      normalizeComparableText(invoice.recipientAttention)
  ) {
    return true;
  }
  if (
    update.recipientLine2 !== undefined &&
    normalizeComparableText(update.recipientLine2) !== normalizeComparableText(invoice.recipientLine2)
  ) {
    return true;
  }
  if (
    update.recipientStreet !== undefined &&
    normalizeComparableText(update.recipientStreet) !== normalizeComparableText(invoice.recipientStreet)
  ) {
    return true;
  }
  if (
    update.recipientHouseNumber !== undefined &&
    normalizeComparableText(update.recipientHouseNumber) !==
      normalizeComparableText(invoice.recipientHouseNumber)
  ) {
    return true;
  }
  if (
    update.recipientZipCode !== undefined &&
    normalizeComparableText(update.recipientZipCode) !== normalizeComparableText(invoice.recipientZipCode)
  ) {
    return true;
  }
  if (
    update.recipientCity !== undefined &&
    normalizeComparableText(update.recipientCity) !== normalizeComparableText(invoice.recipientCity)
  ) {
    return true;
  }
  if (
    update.recipientCountry !== undefined &&
    normalizeComparableText(update.recipientCountry) !== normalizeComparableText(invoice.recipientCountry)
  ) {
    return true;
  }
  if (
    update.recipientEmail !== undefined &&
    normalizeComparableText(update.recipientEmail) !== normalizeComparableText(invoice.recipientEmail)
  ) {
    return true;
  }
  if (
    update.recipientPhone !== undefined &&
    normalizeComparableText(update.recipientPhone) !== normalizeComparableText(invoice.recipientPhone)
  ) {
    return true;
  }
  if (
    update.recipientNotes !== undefined &&
    normalizeComparableText(update.recipientNotes) !== normalizeComparableText(invoice.recipientNotes)
  ) {
    return true;
  }
  if (
    update.smallBusinessEnabled !== undefined &&
    update.smallBusinessEnabled !== invoice.smallBusinessEnabled
  ) {
    return true;
  }
  if (
    update.legalSmallBusinessNote !== undefined &&
    normalizeComparableText(update.legalSmallBusinessNote) !==
      normalizeComparableText(invoice.legalSmallBusinessNote)
  ) {
    return true;
  }
  if (
    update.closingText !== undefined &&
    normalizeComparableText(update.closingText) !== normalizeComparableText(invoice.closingText)
  ) {
    return true;
  }
  if (
    update.additionalFooterNote !== undefined &&
    normalizeComparableText(update.additionalFooterNote) !==
      normalizeComparableText(invoice.additionalFooterNote)
  ) {
    return true;
  }
  if (update.items !== undefined) {
    const incomingItems = update.items.map((item) => ({
      service: item.service,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    }));
    if (hasLockedLineItemChanges(invoice.items, incomingItems)) {
      return true;
    }
  }
  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "invoices:read");
  if (auth.denied) {
    return auth.denied;
  }
  try {
    await ensureDatabaseInitialized();
    await reconcileAppointmentInvoiceConsistency();

    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return validationError(parsedParams.error);
    }

    const invoice = await resolveInvoiceByIdentifier(
      parsedParams.data.id,
      request.nextUrl.searchParams.get("invoiceNumber"),
    );

    if (!invoice) {
      return NextResponse.json({ error: "Rechnung nicht gefunden." }, { status: 404 });
    }

    const settings = await getOrCreateInvoiceSettings(prisma);
    return NextResponse.json(
      applyInvoiceSettingsFallback(toInvoiceDTO(invoice), settings),
    );
  } catch {
    return serverError("Rechnung konnte nicht geladen werden.");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "invoices:write");
  if (auth.denied) {
    return auth.denied;
  }
  try {
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

  const parsed = invoiceUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

    const maxAttempts = parsed.data.action === "FINALIZE" ? 3 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
      const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: parsedParams.data.id },
        include: invoiceInclude,
      });
      if (!invoice) {
        throw new Error("INVOICE_NOT_FOUND");
      }

      if (
        isFinalizedInvoiceState(invoice) &&
        hasLockedFinalizedContentChanges(invoice, parsed.data)
      ) {
        throw new Error("INVOICE_FINALIZED_LOCKED");
      }

      if (parsed.data.deleteDraft) {
        if (invoice.lifecycleStatus !== "ENTWURF") {
          throw new Error("DELETE_ONLY_DRAFT");
        }
        await tx.invoice.delete({ where: { id: invoice.id } });
        if (invoice.appointmentId) {
          await tx.appointment.update({
            where: { id: invoice.appointmentId },
            data: { status: "ERLEDIGT" },
          });
        }
        return { deleted: true as const };
      }

      const nextCustomerId = parsed.data.customerId ?? invoice.customerId;
      if (!nextCustomerId) {
        throw new Error("CUSTOMER_REQUIRED");
      }
      let customerSnapshot: EditableCustomerSnapshot | null = invoice.customer;

      if (parsed.data.customerId !== undefined || !customerSnapshot) {
        customerSnapshot = await tx.customer.findUnique({
          where: { id: nextCustomerId },
          select: invoiceInclude.customer.select,
        });
      }
      if (!customerSnapshot) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      const replacementItems = parsed.data.items?.map((item, index) => ({
        position: index + 1,
        serviceId: item.serviceId ?? null,
        appointmentId: item.appointmentId ?? null,
        title: item.title?.trim() || item.service.trim(),
        description: item.description?.trim() || null,
        service: item.service.trim(),
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents: Math.round(item.quantity * item.unitPriceCents),
      }));

      const linesForValidation = (replacementItems ?? invoice.items).map((item) => ({
        title: item.title,
        service: item.service,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      }));

      const subtotalCents = (replacementItems ?? invoice.items).reduce(
        (sum, item) => sum + item.totalCents,
        0,
      );
      const totalCents = subtotalCents;

      const nextPaymentMethod = parsed.data.paymentMethod ?? invoice.paymentMethod;
      const normalizedCurrentPaymentStatus = invoice.paymentStatus === "PAID" ? "PAID" : "OPEN";
      const nextPaymentStatus =
        parsed.data.paymentStatus ??
        (parsed.data.paymentMethod
          ? defaultPaymentStatusByMethod(parsed.data.paymentMethod)
          : normalizedCurrentPaymentStatus);

      const recipientAutofill =
        parsed.data.customerId !== undefined && customerSnapshot
          ? recipientFromCustomer(customerSnapshot)
          : null;

      const nextRecipient = {
        recipientName:
          parsed.data.recipientName ??
          recipientAutofill?.recipientName ??
          invoice.recipientName,
        recipientAttention:
          parsed.data.recipientAttention ??
          recipientAutofill?.recipientAttention ??
          invoice.recipientAttention,
        recipientLine2:
          parsed.data.recipientLine2 ??
          recipientAutofill?.recipientLine2 ??
          invoice.recipientLine2,
        recipientStreet:
          parsed.data.recipientStreet ??
          recipientAutofill?.recipientStreet ??
          invoice.recipientStreet,
        recipientHouseNumber:
          parsed.data.recipientHouseNumber ??
          recipientAutofill?.recipientHouseNumber ??
          invoice.recipientHouseNumber,
        recipientZipCode:
          parsed.data.recipientZipCode ??
          recipientAutofill?.recipientZipCode ??
          invoice.recipientZipCode,
        recipientCity:
          parsed.data.recipientCity ??
          recipientAutofill?.recipientCity ??
          invoice.recipientCity,
        recipientCountry:
          parsed.data.recipientCountry ??
          recipientAutofill?.recipientCountry ??
          invoice.recipientCountry,
        recipientEmail:
          parsed.data.recipientEmail ??
          recipientAutofill?.recipientEmail ??
          invoice.recipientEmail,
        recipientPhone:
          parsed.data.recipientPhone ??
          recipientAutofill?.recipientPhone ??
          invoice.recipientPhone,
        recipientNotes:
          parsed.data.recipientNotes ??
          recipientAutofill?.recipientNotes ??
          invoice.recipientNotes,
      };

      const finalizationRequested = parsed.data.action === "FINALIZE";
      let nextDocumentStatus = invoice.documentStatus;
      let nextLifecycleStatus = invoice.lifecycleStatus;
      let nextSequence = invoice.sequence;
      let nextInvoiceNumber = invoice.invoiceNumber;
      const issueDate = parsed.data.issueDate
        ? new Date(parsed.data.issueDate)
        : invoice.issueDate;

      if (finalizationRequested) {
        const errors = validateInvoiceFinalizationData({
          totalCents,
          lines: linesForValidation,
          recipient: {
            recipientName: nextRecipient.recipientName,
            recipientStreet: nextRecipient.recipientStreet,
            recipientHouseNumber: nextRecipient.recipientHouseNumber,
            recipientZipCode: nextRecipient.recipientZipCode,
            recipientCity: nextRecipient.recipientCity,
          },
          paymentMethod: nextPaymentMethod,
          bankAccountHolder: invoice.bankAccountHolder,
          bankIban: invoice.bankIban,
        });
        if (errors.length > 0) {
          throw new Error(`FINALIZE_BLOCKED:${errors.join(" | ")}`);
        }

        if (!nextInvoiceNumber || !nextSequence) {
          const max = await tx.invoice.aggregate({ _max: { sequence: true } });
          const nextSequenceValue = (max._max.sequence ?? 0) + 1;
          nextSequence = nextSequenceValue;
          nextInvoiceNumber = formatInvoiceNumber(
            nextSequenceValue,
            issueDate,
            deriveCustomerInitials(nextRecipient.recipientName || customerSnapshot.name),
            "BBS",
          );
        }

        nextDocumentStatus = "FINAL";
        nextLifecycleStatus = "FINALISIERT";
      } else if (
        parsed.data.action === "SAVE_DRAFT" &&
        invoice.lifecycleStatus === "ENTWURF"
      ) {
        nextDocumentStatus = "DRAFT";
        nextLifecycleStatus = "ENTWURF";
      }

      await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          customerId: nextCustomerId,
          customerInitials: deriveCustomerInitials(
            nextRecipient.recipientName || customerSnapshot.name,
          ),
          sequence: nextSequence,
          invoiceNumber: nextInvoiceNumber,
          issueDate,
          serviceDate:
            parsed.data.serviceDate === undefined
              ? invoice.serviceDate
              : parsed.data.serviceDate
                ? new Date(parsed.data.serviceDate)
                : null,
          customerNumber: customerSnapshot.customerNumber ?? invoice.customerNumber,
          amountCents: totalCents,
          subtotalCents,
          totalCents,
          paymentMethod: nextPaymentMethod,
          paymentStatus: nextPaymentStatus,
          paymentDate: nextPaymentStatus === "PAID" ? new Date() : null,
          status: toLegacyInvoiceStatus(nextPaymentStatus),
          documentStatus: nextDocumentStatus,
          lifecycleStatus: nextLifecycleStatus,
          recipientName: nextRecipient.recipientName,
          recipientAttention: nextRecipient.recipientAttention,
          recipientLine2: nextRecipient.recipientLine2,
          recipientStreet: nextRecipient.recipientStreet,
          recipientHouseNumber: nextRecipient.recipientHouseNumber,
          recipientZipCode: nextRecipient.recipientZipCode,
          recipientCity: nextRecipient.recipientCity,
          recipientCountry: nextRecipient.recipientCountry,
          recipientEmail: nextRecipient.recipientEmail,
          recipientPhone: nextRecipient.recipientPhone,
          recipientNotes: nextRecipient.recipientNotes,
          smallBusinessEnabled:
            parsed.data.smallBusinessEnabled ?? invoice.smallBusinessEnabled,
          legalSmallBusinessNote:
            parsed.data.legalSmallBusinessNote ?? invoice.legalSmallBusinessNote,
          closingText: parsed.data.closingText ?? invoice.closingText,
          additionalFooterNote:
            parsed.data.additionalFooterNote ?? invoice.additionalFooterNote,
          pdfGeneratedAt: new Date(),
          lastEditedAt: new Date(),
          items: {
            create: replacementItems ??
              invoice.items.map((item) => ({
                position: item.position,
                serviceId: item.serviceId,
                appointmentId: item.appointmentId,
                title: item.title,
                description: item.description,
                service: item.service,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
                totalCents: item.totalCents,
              })),
          },
        },
        include: invoiceInclude,
      });

      if (updated.appointmentId) {
        await tx.appointment.update({
          where: { id: updated.appointmentId },
          data: {
            status: updated.lifecycleStatus === "FINALISIERT" ? "ABGERECHNET" : "ERLEDIGT",
            isCancelled: false,
            cancellationReason: null,
          },
        });
      }

      return { deleted: false as const, invoice: updated };
    });

      if (result.deleted) {
        return NextResponse.json({ ok: true, deleted: true });
      }

      const settings = await getOrCreateInvoiceSettings(prisma);
      return NextResponse.json(
        applyInvoiceSettingsFallback(toInvoiceDTO(result.invoice), settings),
      );
      } catch (error) {
        const canRetry =
          attempt < maxAttempts &&
          parsed.data.action === "FINALIZE" &&
          isInvoiceNumberConflict(error);

        if (canRetry) {
          continue;
        }

        const mapped = mapUpdateError(error);
        return NextResponse.json({ error: mapped.error }, { status: mapped.status });
      }
    }

    return serverError("Rechnung konnte nicht aktualisiert werden.");
  } catch {
    return serverError("Rechnung konnte nicht aktualisiert werden.");
  }
}
