import type {
  Appointment,
  Customer,
  CustomerNote,
  Invoice,
  InvoiceItem,
  Payment,
  Service,
  TreatmentEntry,
} from "@prisma/client";

import { deriveCustomerStatus } from "@/lib/customer-status";
import {
  toInvoiceKind,
} from "@/lib/invoice-rules";
import type {
  AppointmentDTO,
  CustomerNoteDTO,
  AppointmentStatus,
  CustomerDTO,
  CustomerStatus,
  InvoiceDTO,
  InvoiceStatus,
  PaymentDTO,
  ServiceDTO,
  TreatmentEntryDTO,
} from "@/types/crm";

export function toCustomerDTO(
  customer: Customer & {
    appointments?: Array<{
      id: string;
      startsAt?: Date;
      isCancelled?: boolean;
      invoice?: { status: string } | null;
    }>;
    treatmentEntries?: Array<{ id: string }>;
  },
): CustomerDTO {
  const appointments = customer.appointments ?? [];
  const sortedAppointmentsWithDate = appointments
    .filter((appointment) => appointment.startsAt instanceof Date)
    .sort((left, right) => {
      const leftDate = left.startsAt ? left.startsAt.getTime() : 0;
      const rightDate = right.startsAt ? right.startsAt.getTime() : 0;
      return rightDate - leftDate;
    });

  const lastAppointmentAt = sortedAppointmentsWithDate[0]?.startsAt ?? null;
  const lastInvoiceStatus = sortedAppointmentsWithDate.find(
    (appointment) => appointment.invoice?.status,
  )?.invoice?.status as InvoiceStatus | undefined;

  const manualStatus = (customer.status as CustomerStatus) ?? "NEU";
  const cancellationCount = appointments.reduce(
    (sum, appointment) => sum + (appointment.isCancelled ? 1 : 0),
    0,
  );

  return {
    id: customer.id,
    customerNumber: customer.customerNumber,
    firstName: customer.firstName,
    lastName: customer.lastName,
    displayName: customer.displayName,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    birthday: customer.birthday ? customer.birthday.toISOString() : null,
    preferences: customer.preferences,
    allergies: customer.allergies,
    sensitivities: customer.sensitivities,
    contraindications: customer.contraindications,
    notes: customer.notes,
    source: customer.source,
    tags: customer.tags,
    street: customer.street,
    houseNumber: customer.houseNumber,
    postalCode: customer.postalCode,
    city: customer.city,
    country: customer.country,
    billingAddressEnabled: customer.billingAddressEnabled,
    invoiceRecipientName: customer.invoiceRecipientName,
    invoiceRecipientAttention: customer.invoiceRecipientAttention,
    invoiceRecipientLine2: customer.invoiceRecipientLine2,
    invoiceStreet: customer.invoiceStreet,
    invoiceHouseNumber: customer.invoiceHouseNumber,
    invoicePostalCode: customer.invoicePostalCode,
    invoiceCity: customer.invoiceCity,
    invoiceCountry: customer.invoiceCountry,
    invoiceEmail: customer.invoiceEmail,
    invoicePhone: customer.invoicePhone,
    invoiceNotes: customer.invoiceNotes,
    mediaConsent: customer.mediaConsent,
    mediaConsentAt: customer.mediaConsentAt ? customer.mediaConsentAt.toISOString() : null,
    privacyConsent: customer.privacyConsent,
    privacyConsentAt: customer.privacyConsentAt ? customer.privacyConsentAt.toISOString() : null,
    photoUrl: customer.photoUrl,
    status: deriveCustomerStatus({
      manualStatus,
      lastAppointmentAt,
      appointmentsCount: appointments.length,
    }),
    manualStatus,
    lastAppointmentAt: lastAppointmentAt ? lastAppointmentAt.toISOString() : null,
    lastInvoiceStatus: lastInvoiceStatus ?? null,
    archived: customer.archived,
    appointmentsCount: appointments.length,
    cancellationCount,
    treatmentsCount: customer.treatmentEntries?.length ?? 0,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export function toAppointmentDTO(
  appointment: Appointment & {
    customer: { id: string; name: string; mediaConsent: boolean };
    invoice?: { id: string } | null;
  },
): AppointmentDTO {
  return {
    id: appointment.id,
    title: appointment.title,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt ? appointment.endsAt.toISOString() : null,
    serviceId: appointment.serviceId,
    service: appointment.service,
    status: appointment.status as AppointmentStatus,
    staffName: appointment.staffName,
    roomLabel: appointment.roomLabel,
    plannedPriceCents: appointment.plannedPriceCents,
    finalPriceCents: appointment.finalPriceCents,
    plannedPaymentMethod: appointment.plannedPaymentMethod,
    notes: appointment.notes,
    priceCents: appointment.priceCents,
    isCancelled: appointment.isCancelled,
    cancellationReason: appointment.cancellationReason,
    customerId: appointment.customerId,
    customerName: appointment.customer.name,
    customerMediaConsent: appointment.customer.mediaConsent,
    hasInvoice: Boolean(appointment.invoice?.id),
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}

export function toInvoiceDTO(
  invoice: Invoice & {
    customer: {
      id: string;
      name: string;
    } | null;
    appointment: {
      id: string;
      startsAt: Date;
      service: string;
      customer: { name: string };
    } | null;
    items?: InvoiceItem[];
  },
): InvoiceDTO {
  const sortedItems = (invoice.items ?? [])
    .slice()
    .sort((left, right) => left.position - right.position);
  const mappedItems = sortedItems.map((item) => ({
    id: item.id,
    serviceId: item.serviceId,
    appointmentId: item.appointmentId,
    title: item.title,
    description: item.description,
    position: item.position,
    service: item.service.trim() || item.title?.trim() || "Individuelle Position",
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    totalCents: Number.isFinite(item.totalCents)
      ? item.totalCents
      : Math.round(item.quantity * item.unitPriceCents),
  }));
  const fallbackItem = {
    id: `${invoice.id}-fallback`,
    serviceId: null,
    appointmentId: invoice.appointmentId,
    title: invoice.appointment?.service ?? "Individuelle Position",
    description: null,
    position: 1,
    service: invoice.appointment?.service ?? "Individuelle Position",
    quantity: 1,
    unitPriceCents: invoice.amountCents,
    totalCents: invoice.amountCents,
  };
  const itemsForTotals = mappedItems.length > 0 ? mappedItems : [fallbackItem];
  const derivedSubtotalCents = itemsForTotals.reduce(
    (sum, item) => sum + item.totalCents,
    0,
  );
  const derivedTotalCents = derivedSubtotalCents;

  const appointmentService =
    invoice.appointment?.service ??
    mappedItems[0]?.service ??
    fallbackItem.service;

  const appointmentDate = invoice.appointment?.startsAt
    ? invoice.appointment.startsAt.toISOString()
    : null;

  return {
    id: invoice.id,
    sequence: invoice.sequence,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerInitials: invoice.customerInitials,
    lifecycleStatus: invoice.lifecycleStatus,
    invoiceKind: toInvoiceKind(invoice.totalCents),
    issueDate: invoice.issueDate.toISOString(),
    serviceDate: invoice.serviceDate ? invoice.serviceDate.toISOString() : null,
    customerNumber: invoice.customerNumber,
    amountCents: derivedTotalCents,
    subtotalCents: derivedSubtotalCents,
    totalCents: derivedTotalCents,
    currency: invoice.currency,
    paymentMethod: invoice.paymentMethod,
    paymentStatus: invoice.paymentStatus,
    paymentDate: invoice.paymentDate ? invoice.paymentDate.toISOString() : null,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    paymentDeadlineBusinessDays: invoice.paymentDeadlineBusinessDays,
    smallBusinessEnabled: invoice.smallBusinessEnabled,
    documentStatus: invoice.documentStatus,
    status: invoice.status as InvoiceStatus,
    pdfPath: invoice.pdfPath,
    pdfGeneratedAt: invoice.pdfGeneratedAt ? invoice.pdfGeneratedAt.toISOString() : null,
    pdfDownloadedAt: invoice.pdfDownloadedAt
      ? invoice.pdfDownloadedAt.toISOString()
      : null,
    pdfMarkedSavedAt: invoice.pdfMarkedSavedAt
      ? invoice.pdfMarkedSavedAt.toISOString()
      : null,
    pdfFileName: invoice.pdfFileName,
    appointmentId: invoice.appointmentId,
    appointmentService,
    appointmentDate,
    customerName: (invoice.customer?.name ?? invoice.recipientName) || "Unbekannte Kundin",
    recipientLabel: invoice.recipientLabel,
    recipientName: invoice.recipientName,
    recipientAttention: invoice.recipientAttention,
    recipientLine2: invoice.recipientLine2,
    recipientStreet: invoice.recipientStreet,
    recipientHouseNumber: invoice.recipientHouseNumber,
    recipientZipCode: invoice.recipientZipCode,
    recipientCity: invoice.recipientCity,
    recipientCountry: invoice.recipientCountry,
    recipientEmail: invoice.recipientEmail,
    recipientPhone: invoice.recipientPhone,
    recipientNotes: invoice.recipientNotes,
    senderBusinessName: invoice.senderBusinessName,
    senderOwnerName: invoice.senderOwnerName,
    senderStreet: invoice.senderStreet,
    senderHouseNumber: invoice.senderHouseNumber,
    senderZipCode: invoice.senderZipCode,
    senderCity: invoice.senderCity,
    senderPhone: invoice.senderPhone,
    senderEmail: invoice.senderEmail,
    senderTaxNumber: invoice.senderTaxNumber,
    senderVatId: invoice.senderVatId,
    bankAccountHolder: invoice.bankAccountHolder,
    bankIban: invoice.bankIban,
    bankBic: invoice.bankBic,
    bankName: invoice.bankName,
    transferPaymentTitle: invoice.transferPaymentTitle,
    transferPaymentNotice: invoice.transferPaymentNotice,
    cashPaymentTitle: invoice.cashPaymentTitle,
    cashPaymentNote: invoice.cashPaymentNote,
    cardPaymentTitle: invoice.cardPaymentTitle,
    cardPaymentNote: invoice.cardPaymentNote,
    legalSmallBusinessNote: invoice.legalSmallBusinessNote,
    closingText: invoice.closingText,
    additionalFooterNote: invoice.additionalFooterNote,
    items: itemsForTotals,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

export function toTreatmentEntryDTO(entry: TreatmentEntry): TreatmentEntryDTO {
  return {
    id: entry.id,
    customerId: entry.customerId,
    performedAt: entry.performedAt.toISOString(),
    treatment: entry.treatment,
    style: entry.style,
    technique: entry.technique,
    length: entry.length,
    note: entry.note,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function toServiceDTO(service: Service): ServiceDTO {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    description: service.description,
    defaultPriceCents: service.defaultPriceCents,
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    sortOrder: service.sortOrder,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

export function toCustomerNoteDTO(note: CustomerNote): CustomerNoteDTO {
  return {
    id: note.id,
    customerId: note.customerId,
    noteType: note.noteType,
    title: note.title,
    content: note.content,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function toPaymentDTO(payment: Payment): PaymentDTO {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    method: payment.method,
    status: payment.status,
    amountCents: payment.amountCents,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    reference: payment.reference,
    note: payment.note,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}
