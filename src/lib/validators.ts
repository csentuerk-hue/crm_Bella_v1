import { z } from "zod";

import {
  APPOINTMENT_STATUS,
  CUSTOMER_NOTE_TYPE,
  CUSTOMER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
} from "@/types/crm";

export const customerInputSchema = z
  .object({
    customerNumber: z.string().max(64).optional().nullable(),
    firstName: z.string().max(120).optional().nullable(),
    lastName: z.string().max(120).optional().nullable(),
    displayName: z.string().max(180).optional().nullable(),
    name: z.string().min(2, "Name ist zu kurz."),
    email: z.string().email().optional().nullable(),
    phone: z.string().min(5).optional().nullable(),
    birthday: z.string().date().optional().nullable(),
    preferences: z.string().max(2000).optional().nullable(),
    allergies: z.string().max(2000).optional().nullable(),
    sensitivities: z.string().max(2000).optional().nullable(),
    contraindications: z.string().max(2000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    source: z.string().max(180).optional().nullable(),
    tags: z.string().max(500).optional().nullable(),
    street: z.string().max(160).optional().nullable(),
    houseNumber: z.string().max(32).optional().nullable(),
    postalCode: z.string().max(32).optional().nullable(),
    city: z.string().max(120).optional().nullable(),
    country: z.string().max(120).optional().nullable(),
    billingAddressEnabled: z.boolean().optional(),
    invoiceRecipientName: z.string().max(200).optional().nullable(),
    invoiceRecipientAttention: z.string().max(200).optional().nullable(),
    invoiceRecipientLine2: z.string().max(200).optional().nullable(),
    invoiceStreet: z.string().max(160).optional().nullable(),
    invoiceHouseNumber: z.string().max(32).optional().nullable(),
    invoicePostalCode: z.string().max(32).optional().nullable(),
    invoiceCity: z.string().max(120).optional().nullable(),
    invoiceCountry: z.string().max(120).optional().nullable(),
    invoiceEmail: z.string().email().optional().nullable(),
    invoicePhone: z.string().max(80).optional().nullable(),
    invoiceNotes: z.string().max(2000).optional().nullable(),
    mediaConsent: z.boolean().optional(),
    privacyConsent: z.boolean().optional(),
    photoUrl: z.string().url().optional().nullable(),
    status: z.enum(CUSTOMER_STATUS).optional(),
    archived: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.billingAddressEnabled) {
      return;
    }

    const requiredFields: Array<{ key: keyof typeof value; label: string }> = [
      { key: "invoiceRecipientName", label: "Rechnungsempfängername" },
      { key: "invoiceStreet", label: "Rechnungsstraße" },
      { key: "invoiceHouseNumber", label: "Rechnungshausnummer" },
      { key: "invoicePostalCode", label: "Rechnungs-PLZ" },
      { key: "invoiceCity", label: "Rechnungsort" },
    ];

    for (const field of requiredFields) {
      const raw = value[field.key];
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field.key],
          message: `${field.label} ist erforderlich, wenn eine abweichende Rechnungsadresse aktiv ist.`,
        });
      }
    }
  });

export const appointmentInputSchema = z.object({
  title: z.string().max(180).optional().nullable(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
  serviceId: z.string().min(1).optional().nullable(),
  service: z.string().min(2, "Leistung ist zu kurz."),
  status: z.enum(APPOINTMENT_STATUS).optional(),
  staffName: z.string().max(120).optional().nullable(),
  roomLabel: z.string().max(120).optional().nullable(),
  plannedPriceCents: z.number().int().nonnegative().optional().nullable(),
  finalPriceCents: z.number().int().nonnegative().optional().nullable(),
  plannedPaymentMethod: z.enum(PAYMENT_METHOD).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  priceCents: z.number().int().nonnegative(),
  customerId: z.string().min(1),
  isCancelled: z.boolean().optional(),
  cancellationReason: z.string().max(500).optional().nullable(),
});

export const appointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUS),
});

export const invoiceCreateSchema = z
  .object({
    customerId: z.string().min(1, "Bitte eine Kundin auswählen."),
    appointmentId: z.string().min(1).optional().nullable(),
    paymentMethod: z.enum(PAYMENT_METHOD).optional(),
    paymentStatus: z.enum(["OPEN", "PAID"]).optional(),
    items: z
      .array(
        z.object({
          name: z.string().min(1, "Positionsname ist erforderlich."),
          quantity: z.number().positive("Menge muss größer als 0 sein."),
          priceCents: z.number().int().nonnegative("Preis muss >= 0 sein."),
          description: z.string().max(2000).optional().nullable(),
          serviceId: z.string().min(1).optional().nullable(),
        }),
      )
      .optional()
      .default([]),
  });

export const invoiceLineItemUpdateSchema = z.object({
  id: z.string().optional(),
  serviceId: z.string().min(1).optional().nullable(),
  appointmentId: z.string().min(1).optional().nullable(),
  title: z.string().max(240).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  service: z.string().min(1, "Bitte eine Bezeichnung angeben."),
  quantity: z.number().positive("Menge muss größer als 0 sein."),
  unitPriceCents: z.number().int().nonnegative("Preis muss >= 0 sein."),
});

export const invoiceUpdateSchema = z.object({
  customerId: z.string().min(1, "Bitte eine Kundin auswählen.").optional(),
  paymentMethod: z.enum(PAYMENT_METHOD).optional(),
  paymentStatus: z.enum(["OPEN", "PAID"]).optional(),
  issueDate: z.string().datetime({ offset: true }).optional(),
  serviceDate: z.string().datetime({ offset: true }).optional().nullable(),
  recipientName: z.string().max(200).optional(),
  recipientAttention: z.string().max(200).optional(),
  recipientLine2: z.string().max(200).optional(),
  recipientStreet: z.string().max(160).optional(),
  recipientHouseNumber: z.string().max(32).optional(),
  recipientZipCode: z.string().max(32).optional(),
  recipientCity: z.string().max(120).optional(),
  recipientCountry: z.string().max(120).optional(),
  recipientEmail: z.string().max(180).optional(),
  recipientPhone: z.string().max(80).optional(),
  recipientNotes: z.string().max(2000).optional(),
  additionalFooterNote: z.string().max(2000).optional(),
  closingText: z.string().max(2000).optional(),
  legalSmallBusinessNote: z.string().max(2000).optional(),
  smallBusinessEnabled: z.boolean().optional(),
  items: z.array(invoiceLineItemUpdateSchema).optional(),
  action: z.enum(["SAVE_DRAFT", "FINALIZE"]).optional(),
  deleteDraft: z.boolean().optional(),
});

export const invoiceSettingsUpdateSchema = z.object({
  businessName: z.string().min(1).max(160),
  ownerName: z.string().max(160),
  street: z.string().max(160),
  houseNumber: z.string().max(32),
  zipCode: z.string().max(32),
  city: z.string().max(120),
  phone: z.string().max(80),
  email: z.string().max(160),
  taxNumber: z.string().max(120),
  vatId: z.string().max(120),
  bankAccountHolder: z.string().max(160),
  bankIban: z.string().max(64),
  bankBic: z.string().max(64),
  bankName: z.string().max(160),
  smallBusinessEnabled: z.boolean(),
  defaultPaymentDeadlineBusinessDays: z.number().int().min(0).max(365),
  defaultCurrency: z.string().max(8),
  defaultPaymentMethod: z.enum(PAYMENT_METHOD),
  invoicePrefix: z.string().max(20),
  recipientLabel: z.string().max(120),
  transferPaymentTitle: z.string().max(200),
  transferPaymentNotice: z.string().max(2000),
  cashPaymentTitle: z.string().max(200),
  cashPaymentNote: z.string().max(2000),
  cardPaymentTitle: z.string().max(200),
  cardPaymentNote: z.string().max(2000),
  legalSmallBusinessNote: z.string().max(2000),
  closingText: z.string().max(2000),
  additionalFooterNote: z.string().max(2000),
});

export const treatmentEntryInputSchema = z.object({
  performedAt: z.string().datetime({ offset: true }),
  treatment: z.string().min(2).max(120),
  style: z.string().max(120).optional().nullable(),
  technique: z.string().max(120).optional().nullable(),
  length: z.string().max(120).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export const serviceInputSchema = z.object({
  name: z.string().min(2).max(160),
  category: z.string().max(120).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  defaultPriceCents: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const customerNoteInputSchema = z.object({
  noteType: z.enum(CUSTOMER_NOTE_TYPE).optional(),
  title: z.string().max(180).optional().nullable(),
  content: z.string().min(1).max(4000),
});

export const paymentInputSchema = z.object({
  method: z.enum(PAYMENT_METHOD),
  status: z.enum(PAYMENT_STATUS).optional(),
  amountCents: z.number().int().nonnegative(),
  paidAt: z.string().datetime({ offset: true }).optional().nullable(),
  reference: z.string().max(180).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

