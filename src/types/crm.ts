export const APPOINTMENT_STATUS = [
  "OFFEN",
  "GEPLANT",
  "ERLEDIGT",
  "ABGERECHNET",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

export const CUSTOMER_STATUS = ["NEU", "AKTIV", "INAKTIV"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUS)[number];

export const INVOICE_STATUS = ["OFFEN", "BEZAHLT", "STORNIERT"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const INVOICE_LIFECYCLE_STATUS = ["ENTWURF", "FINALISIERT"] as const;
export type InvoiceLifecycleStatus = (typeof INVOICE_LIFECYCLE_STATUS)[number];

export const PAYMENT_METHOD = ["BANK_TRANSFER", "CASH", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[number];

export const PAYMENT_STATUS = [
  "OPEN",
  "PAID",
  "PARTIALLY_PAID",
  "FAILED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const INVOICE_DOCUMENT_STATUS = [
  "DRAFT",
  "FINAL",
  "SENT",
  "CANCELLED",
] as const;
export type InvoiceDocumentStatus = (typeof INVOICE_DOCUMENT_STATUS)[number];

export const CUSTOMER_NOTE_TYPE = [
  "GENERAL",
  "APPOINTMENT",
  "INVOICE",
  "CARE",
  "WARNING",
] as const;
export type CustomerNoteType = (typeof CUSTOMER_NOTE_TYPE)[number];

export type CustomerDTO = {
  id: string;
  customerNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  preferences: string | null;
  allergies: string | null;
  sensitivities: string | null;
  contraindications: string | null;
  notes: string | null;
  source: string | null;
  tags: string | null;
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
  mediaConsent: boolean;
  mediaConsentAt: string | null;
  privacyConsent: boolean;
  privacyConsentAt: string | null;
  photoUrl: string | null;
  status: CustomerStatus;
  manualStatus: CustomerStatus;
  lastAppointmentAt: string | null;
  lastInvoiceStatus: InvoiceStatus | null;
  archived: boolean;
  appointmentsCount: number;
  cancellationCount: number;
  treatmentsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TreatmentEntryDTO = {
  id: string;
  customerId: string | null;
  performedAt: string;
  treatment: string;
  style: string | null;
  technique: string | null;
  length: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentDTO = {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  serviceId: string | null;
  service: string;
  status: AppointmentStatus;
  staffName: string | null;
  roomLabel: string | null;
  plannedPriceCents: number | null;
  finalPriceCents: number | null;
  plannedPaymentMethod: PaymentMethod | null;
  notes: string | null;
  priceCents: number;
  isCancelled: boolean;
  cancellationReason: string | null;
  customerId: string;
  customerName: string;
  customerMediaConsent: boolean;
  hasInvoice: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceDTO = {
  id: string;
  sequence: number | null;
  invoiceNumber: string | null;
  customerId: string | null;
  customerInitials: string;
  lifecycleStatus: InvoiceLifecycleStatus;
  invoiceKind: "KLEINBETRAGSRECHNUNG" | "VOLLRECHNUNG";
  issueDate: string;
  serviceDate: string | null;
  customerNumber: string | null;
  amountCents: number;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentDate: string | null;
  dueDate: string | null;
  paymentDeadlineBusinessDays: number;
  smallBusinessEnabled: boolean;
  documentStatus: InvoiceDocumentStatus;
  status: InvoiceStatus;
  pdfPath: string | null;
  pdfGeneratedAt: string | null;
  appointmentId: string | null;
  appointmentService: string | null;
  appointmentDate: string | null;
  customerName: string;
  recipientLabel: string;
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
  senderBusinessName: string;
  senderOwnerName: string;
  senderStreet: string;
  senderHouseNumber: string;
  senderZipCode: string;
  senderCity: string;
  senderPhone: string;
  senderEmail: string;
  senderTaxNumber: string;
  senderVatId: string;
  bankAccountHolder: string;
  bankIban: string;
  bankBic: string;
  bankName: string;
  transferPaymentTitle: string;
  transferPaymentNotice: string;
  cashPaymentTitle: string;
  cashPaymentNote: string;
  cardPaymentTitle: string;
  cardPaymentNote: string;
  legalSmallBusinessNote: string;
  closingText: string;
  additionalFooterNote: string;
  items: InvoiceItemDTO[];
  createdAt: string;
  updatedAt: string;
};

export type InvoiceItemDTO = {
  id: string;
  serviceId: string | null;
  appointmentId: string | null;
  title: string | null;
  description: string | null;
  position: number;
  service: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type ServiceDTO = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  defaultPriceCents: number;
  durationMinutes: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomerNoteDTO = {
  id: string;
  customerId: string;
  noteType: CustomerNoteType;
  title: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentDTO = {
  id: string;
  invoiceId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountCents: number;
  paidAt: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceSettingsDTO = {
  businessName: string;
  ownerName: string;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  phone: string;
  email: string;
  taxNumber: string;
  vatId: string;
  bankAccountHolder: string;
  bankIban: string;
  bankBic: string;
  bankName: string;
  smallBusinessEnabled: boolean;
  defaultPaymentDeadlineBusinessDays: number;
  defaultCurrency: string;
  defaultPaymentMethod: PaymentMethod;
  invoicePrefix: string;
  recipientLabel: string;
  transferPaymentTitle: string;
  transferPaymentNotice: string;
  cashPaymentTitle: string;
  cashPaymentNote: string;
  cardPaymentTitle: string;
  cardPaymentNote: string;
  legalSmallBusinessNote: string;
  closingText: string;
  additionalFooterNote: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardPayload = {
  metrics: {
    openAppointments: number;
    plannedAppointments: number;
    completedRevenueCents: number;
    invoicesOpen: number;
    archivedCustomers: number;
  };
  chartSeries: {
    revenueByMonth: Array<{ month: string; valueCents: number }>;
    appointmentsByStatus: Array<{ status: AppointmentStatus; count: number }>;
    invoiceByStatus: Array<{ status: InvoiceStatus; count: number }>;
  };
  latest: {
    appointments: AppointmentDTO[];
    customers: CustomerDTO[];
    invoices: InvoiceDTO[];
  };
  followUps: Array<{
    customerId: string;
    customerName: string;
    status: "AKTIV" | "UEBERFAELLIG" | "INAKTIV";
    lastAppointmentAt: string | null;
    suggestedRefillDate: string | null;
    daysSinceLast: number | null;
  }>;
};
