import type {
  AppointmentStatus,
  CustomerStatus,
  InvoiceLifecycleStatus,
  InvoiceStatus,
} from "@/types/crm";

export const APP_NAME = "Bella by Sobiella CRM";

export const BRAND_COLORS = {
  petrol: "#0F5A55",
  deepGreen: "#1A3F39",
  roseGold: "#B76E79",
  mintPastel: "#E4F5EF",
  blushPastel: "#F8E8EC",
  sandPastel: "#F9F2E8",
  skyPastel: "#EAF2F8",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  OFFEN: "Offen",
  GEPLANT: "Geplant",
  ERLEDIGT: "Erledigt",
  ABGERECHNET: "Abgerechnet",
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  NEU: "Neu",
  AKTIV: "Aktiv",
  INAKTIV: "Inaktiv",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  OFFEN: "Offen",
  BEZAHLT: "Bezahlt",
  STORNIERT: "Storniert",
};

export const INVOICE_LIFECYCLE_LABELS: Record<InvoiceLifecycleStatus, string> = {
  ENTWURF: "Entwurf",
  FINALISIERT: "Finalisiert",
};

export const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Kundinnen", href: "/customers" },
  { label: "Termine", href: "/appointments" },
  { label: "Rechnungen", href: "/invoices" },
  { label: "Einstellungen", href: "/settings" },
];
