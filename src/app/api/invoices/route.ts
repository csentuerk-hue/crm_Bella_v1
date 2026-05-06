import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverError, validationError } from "@/lib/api";
import { reconcileAppointmentInvoiceConsistency } from "@/lib/data-consistency";
import { deriveCustomerInitials } from "@/lib/invoice-number";
import { defaultPaymentStatusByMethod } from "@/lib/invoice-rules";
import {
  getOrCreateInvoiceSettings,
  injectBusinessDayPlaceholder,
} from "@/lib/invoice-settings";
import { applyInvoiceSettingsFallback } from "@/lib/invoice-view";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toInvoiceDTO } from "@/lib/serializers";
import { invoiceCreateSchema } from "@/lib/validators";
import type { PaymentMethod } from "@/types/crm";

const listQuerySchema = z.object({
  status: z.enum(["OFFEN", "BEZAHLT"]).optional(),
  lifecycle: z.enum(["ENTWURF", "FINALISIERT"]).optional(),
  customerId: z.string().optional(),
  query: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const invoiceInclude = {
  customer: {
    select: {
      id: true,
      name: true,
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
  items: true,
} as const;

type RecipientSource = {
  name: string;
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

function addBusinessDays(baseDate: Date, businessDays: number): Date {
  const date = new Date(baseDate);
  let remaining = Math.max(0, businessDays);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return date;
}

function toLegacyInvoiceStatus(paymentStatus: "OPEN" | "PAID"): "OFFEN" | "BEZAHLT" {
  return paymentStatus === "PAID" ? "BEZAHLT" : "OFFEN";
}

function resolveRecipientFromCustomer(customer: RecipientSource | null) {
  if (!customer) {
    return {
      recipientName: "",
      recipientAttention: "",
      recipientLine2: "",
      recipientStreet: "",
      recipientHouseNumber: "",
      recipientZipCode: "",
      recipientCity: "",
      recipientCountry: "Deutschland",
      recipientEmail: "",
      recipientPhone: "",
      recipientNotes: "",
    };
  }

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

function mapCreateError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "APPOINTMENT_NOT_FOUND") {
    return { status: 404, error: "Termin wurde nicht gefunden." };
  }
  if (message === "APPOINTMENT_CANCELLED") {
    return { status: 409, error: "Stornierte Termine können nicht abgerechnet werden." };
  }
  if (message === "CUSTOMER_NOT_FOUND") {
    return { status: 404, error: "Kundin wurde nicht gefunden." };
  }
  if (message === "CUSTOMER_REQUIRED") {
    return { status: 422, error: "Bitte eine Kundin auswählen." };
  }
  if (message === "APPOINTMENT_CUSTOMER_MISMATCH") {
    return { status: 409, error: "Kundin passt nicht zum ausgewählten Termin." };
  }

  return {
    status: 500,
    error: "Rechnung konnte nicht erstellt werden.",
  };
}

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "invoices:read");
  if (auth.denied) {
    return auth.denied;
  }
  try {
    await ensureDatabaseInitialized();
    await reconcileAppointmentInvoiceConsistency();

    const parsed = listQuerySchema.safeParse({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      lifecycle: request.nextUrl.searchParams.get("lifecycle") ?? undefined,
      customerId: request.nextUrl.searchParams.get("customerId") ?? undefined,
      query: request.nextUrl.searchParams.get("query") ?? undefined,
      dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
      dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined,
    });
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const query = parsed.data.query?.trim();
    const sequenceQuery = query && /^\d+$/.test(query) ? Number.parseInt(query, 10) : undefined;
    const issueDateFilter = (() => {
      const from = parsed.data.dateFrom?.trim();
      const to = parsed.data.dateTo?.trim();
      if (!from && !to) {
        return undefined;
      }
      const filter: { gte?: Date; lte?: Date } = {};
      if (from) {
        const fromDate = new Date(`${from}T00:00:00.000`);
        if (!Number.isNaN(fromDate.getTime())) {
          filter.gte = fromDate;
        }
      }
      if (to) {
        const toDate = new Date(`${to}T23:59:59.999`);
        if (!Number.isNaN(toDate.getTime())) {
          filter.lte = toDate;
        }
      }
      return Object.keys(filter).length > 0 ? filter : undefined;
    })();

    const invoices = await prisma.invoice.findMany({
      where: {
        status: parsed.data.status,
        lifecycleStatus: parsed.data.lifecycle,
        customerId: parsed.data.customerId,
        issueDate: issueDateFilter,
        AND: query
          ? {
              OR: [
                { invoiceNumber: { contains: query, mode: "insensitive" } },
                { customerInitials: { contains: query.toUpperCase(), mode: "insensitive" } },
                { recipientName: { contains: query, mode: "insensitive" } },
                { customer: { name: { contains: query, mode: "insensitive" } } },
                ...(sequenceQuery !== undefined ? [{ sequence: sequenceQuery }] : []),
              ],
            }
          : undefined,
      },
      include: {
        appointment: invoiceInclude.appointment,
        items: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    });
    const validInvoices = invoices.filter(
      (invoice): invoice is typeof invoice & { customerId: string } =>
        typeof invoice.customerId === "string" && invoice.customerId.trim().length > 0,
    );
    const customerIds = Array.from(
      new Set(validInvoices.map((invoice) => invoice.customerId)),
    );
    const customers =
      customerIds.length === 0
        ? []
        : await prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: {
              id: true,
              name: true,
            },
          });
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const settings = await getOrCreateInvoiceSettings(prisma);

    return NextResponse.json(
      validInvoices.map((invoice) =>
        applyInvoiceSettingsFallback(
          toInvoiceDTO({
            ...invoice,
            customer: customerById.get(invoice.customerId) ?? null,
          }),
          settings,
        ),
      ),
    );
  } catch {
    return serverError("Rechnungen konnten nicht geladen werden.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, "invoices:write");
  if (auth.denied) {
    return auth.denied;
  }
  try {
    await ensureDatabaseInitialized();
    await reconcileAppointmentInvoiceConsistency();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    const parsed = invoiceCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const appointmentId = parsed.data.appointmentId?.trim() || null;
    const explicitCustomerId = parsed.data.customerId.trim();

    try {
      const created = await prisma.$transaction(async (tx) => {
        const settings = await getOrCreateInvoiceSettings(tx);
        const issueDate = new Date();
        const serviceDate = appointmentId ? null : issueDate;
        const paymentMethod = (parsed.data.paymentMethod ??
          settings.defaultPaymentMethod) as PaymentMethod;
        const paymentStatus =
          parsed.data.paymentStatus ?? defaultPaymentStatusByMethod(paymentMethod);
        const dueDate = addBusinessDays(
          issueDate,
          settings.defaultPaymentDeadlineBusinessDays,
        );

        let appointment:
          | {
              id: string;
              startsAt: Date;
              serviceId: string | null;
              service: string;
              priceCents: number;
              finalPriceCents: number | null;
              notes: string | null;
              isCancelled: boolean;
              customerId: string;
              invoice: { id: string } | null;
            }
          | null = null;

        if (appointmentId) {
          appointment = await tx.appointment.findUnique({
            where: { id: appointmentId },
            include: { invoice: { select: { id: true } } },
          });
          if (!appointment) {
            throw new Error("APPOINTMENT_NOT_FOUND");
          }
          if (appointment.isCancelled) {
            throw new Error("APPOINTMENT_CANCELLED");
          }
          if (appointment.invoice) {
            const existingInvoice = await tx.invoice.findUnique({
              where: { appointmentId: appointment.id },
              include: invoiceInclude,
            });
            if (existingInvoice) {
              return existingInvoice;
            }
          }
        }

        const customerId = appointment ? appointment.customerId : explicitCustomerId;
        if (!customerId) {
          throw new Error("CUSTOMER_REQUIRED");
        }
        if (appointment && explicitCustomerId !== appointment.customerId) {
          throw new Error("APPOINTMENT_CUSTOMER_MISMATCH");
        }
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: {
            id: true,
            customerNumber: true,
            name: true,
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
        });
        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        const recipient = resolveRecipientFromCustomer(customer);

        const lineItems = appointment
          ? [
              {
                position: 1,
                serviceId: appointment.serviceId,
                appointmentId: appointment.id,
                title: appointment.service,
                description: appointment.notes,
                service: appointment.service,
                quantity: 1,
                unitPriceCents: appointment.finalPriceCents ?? appointment.priceCents,
                totalCents: appointment.finalPriceCents ?? appointment.priceCents,
              },
            ]
          : parsed.data.items.map((item, index) => ({
              position: index + 1,
              serviceId: item.serviceId ?? null,
              appointmentId: null,
              title: item.name.trim(),
              description: item.description?.trim() || null,
              service: item.name.trim(),
              quantity: item.quantity,
              unitPriceCents: item.priceCents,
              totalCents: Math.round(item.quantity * item.priceCents),
            }));

        const subtotalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);
        const totalCents = subtotalCents;
        const customerInitials = deriveCustomerInitials(
          customer.name || recipient.recipientName || "Kundin",
        );

        return tx.invoice.create({
          data: {
            sequence: null,
            invoiceNumber: null,
            customerId: customer.id,
            customerInitials,
            issueDate,
            serviceDate: appointment ? appointment.startsAt : serviceDate,
            customerNumber: customer.customerNumber ?? null,
            amountCents: totalCents,
            subtotalCents,
            totalCents,
            currency: settings.defaultCurrency,
            paymentMethod,
            paymentStatus,
            paymentDate: paymentStatus === "PAID" ? new Date() : null,
            dueDate,
            paymentDeadlineBusinessDays: settings.defaultPaymentDeadlineBusinessDays,
            smallBusinessEnabled: settings.smallBusinessEnabled,
            documentStatus: "DRAFT",
            lifecycleStatus: "ENTWURF",
            status: toLegacyInvoiceStatus(paymentStatus),
            appointmentId: appointment?.id ?? null,
            pdfPath: null,
            pdfGeneratedAt: new Date(),
            senderBusinessName: settings.businessName,
            senderOwnerName: settings.ownerName,
            senderStreet: settings.street,
            senderHouseNumber: settings.houseNumber,
            senderZipCode: settings.zipCode,
            senderCity: settings.city,
            senderPhone: settings.phone,
            senderEmail: settings.email,
            senderTaxNumber: settings.taxNumber,
            senderVatId: settings.vatId,
            recipientLabel: settings.recipientLabel,
            recipientName: recipient.recipientName,
            recipientAttention: recipient.recipientAttention,
            recipientLine2: recipient.recipientLine2,
            recipientStreet: recipient.recipientStreet,
            recipientHouseNumber: recipient.recipientHouseNumber,
            recipientZipCode: recipient.recipientZipCode,
            recipientCity: recipient.recipientCity,
            recipientCountry: recipient.recipientCountry,
            recipientEmail: recipient.recipientEmail,
            recipientPhone: recipient.recipientPhone,
            recipientNotes: recipient.recipientNotes,
            bankAccountHolder: settings.bankAccountHolder,
            bankIban: settings.bankIban,
            bankBic: settings.bankBic,
            bankName: settings.bankName,
            transferPaymentTitle: settings.transferPaymentTitle,
            transferPaymentNotice: injectBusinessDayPlaceholder(
              settings.transferPaymentNotice,
              settings.defaultPaymentDeadlineBusinessDays,
            ),
            cashPaymentTitle: settings.cashPaymentTitle,
            cashPaymentNote: settings.cashPaymentNote,
            cardPaymentTitle: settings.cardPaymentTitle,
            cardPaymentNote: settings.cardPaymentNote,
            legalSmallBusinessNote: settings.legalSmallBusinessNote,
            closingText: settings.closingText,
            additionalFooterNote: settings.additionalFooterNote,
            lastEditedAt: new Date(),
            items: {
              create: lineItems,
            },
          },
          include: invoiceInclude,
        });
      });

      const settings = await getOrCreateInvoiceSettings(prisma);
      return NextResponse.json(
        applyInvoiceSettingsFallback(toInvoiceDTO(created), settings),
        { status: 201 },
      );
    } catch (error) {
      const mapped = mapCreateError(error);
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }
  } catch {
    return serverError("Rechnung konnte nicht erstellt werden.");
  }
}
