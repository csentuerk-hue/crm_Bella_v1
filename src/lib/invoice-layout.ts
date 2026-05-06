import { formatEuroFromCents } from "@/lib/currency";
import { formatDate } from "@/lib/datetime";
import { normalizeInvoiceTextValue } from "@/lib/invoice-language";
import type { InvoiceDTO, InvoiceItemDTO } from "@/types/crm";

export type InvoiceLayoutPayment = {
  title: string;
  leftLines: string[];
  rightLines: string[];
};

export type InvoiceLayoutModel = {
  invoiceLabel: string;
  issueDate: string;
  serviceDate: string;
  paymentMethodLabel: string;
  customerNumberLabel: string;
  senderLines: string[];
  recipientLines: string[];
  items: Array<{
    id: string;
    position: number;
    service: string;
    description: string;
    quantity: string;
    unitPrice: string;
    total: string;
    unitPriceCents: number;
    totalCents: number;
  }>;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  subtotalDisplay: string;
  discountDisplay: string;
  totalDisplay: string;
  payableHint: string;
  payment: InvoiceLayoutPayment;
  legalNote: string | null;
  closingText: string;
  additionalFooterNote: string;
};

export const INVOICE_LAYOUT_DIMENSIONS = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  pagePaddingX: 34,
  contentWidth: 527,
  logoMaxWidth: 232,
  logoMaxHeight: 124,
  metaColumnWidth: 234,
  recipientBoxWidth: 292,
  totalsBoxWidth: 214,
} as const;

const STALE_FOOTER_PATTERN = /aktualisierter\s+abschlusstext\s+\d+/i;

function compact(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function lineOrFallback(value: string | null | undefined, fallback = "Nicht hinterlegt"): string {
  const normalized = compact(value);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeServiceLabel(item: InvoiceItemDTO, fallbackService: string): string {
  const service = compact(item.service);
  if (service) {
    return service;
  }
  const title = compact(item.title);
  if (title) {
    return title;
  }
  const fallback = compact(fallbackService);
  if (fallback) {
    return fallback;
  }
  return "Individuelle Position";
}

function sanitizeFooterText(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  if (STALE_FOOTER_PATTERN.test(normalized)) {
    return "";
  }
  return normalized;
}

function paymentMethodLabel(method: InvoiceDTO["paymentMethod"]): string {
  if (method === "BANK_TRANSFER") {
    return "Überweisung";
  }
  if (method === "CASH") {
    return "Bar";
  }
  return "Kartenzahlung";
}

export function deriveInvoiceItemsWithTotals(invoice: InvoiceDTO) {
  const fallbackService = compact(invoice.appointmentService);
  const items = invoice.items.map((item) => {
    const service = normalizeServiceLabel(item, fallbackService);
    const totalCents = Number.isFinite(item.totalCents)
      ? item.totalCents
      : Math.round(item.quantity * item.unitPriceCents);
    return {
      ...item,
      service,
      totalCents,
    };
  });

  if (items.length > 0) {
    return items;
  }

  return [
    {
      id: `${invoice.id}-fallback`,
      serviceId: null,
      appointmentId: invoice.appointmentId,
      title: fallbackService || "Individuelle Position",
      description: null,
      position: 1,
      service: fallbackService || "Individuelle Position",
      quantity: 1,
      unitPriceCents: invoice.totalCents || invoice.amountCents || 0,
      totalCents: invoice.totalCents || invoice.amountCents || 0,
    },
  ];
}

function buildPaymentBlock(invoice: InvoiceDTO): InvoiceLayoutPayment {
  const transferPaymentTitle = normalizeInvoiceTextValue(
    invoice.transferPaymentTitle,
    "Zahlungsart: Überweisung",
  );
  const transferPaymentNotice = normalizeInvoiceTextValue(
    invoice.transferPaymentNotice,
    "Zahlungsziel: innerhalb der nächsten 10 Werktage.",
  );
  const cashPaymentTitle = normalizeInvoiceTextValue(
    invoice.cashPaymentTitle,
    "Zahlungsart: Barzahlung",
  );
  const cashPaymentNote = normalizeInvoiceTextValue(
    invoice.cashPaymentNote,
    "Der Betrag wurde in bar beglichen.",
  );
  const cardPaymentTitle = normalizeInvoiceTextValue(
    invoice.cardPaymentTitle,
    "Zahlungsart: Kartenzahlung",
  );
  const cardPaymentNote = normalizeInvoiceTextValue(
    invoice.cardPaymentNote,
    "Der Betrag wurde per Kartenzahlung beglichen.",
  );

  if (invoice.paymentMethod === "BANK_TRANSFER") {
    return {
      title: transferPaymentTitle,
      leftLines: [
        `Kontoinhaber: ${lineOrFallback(invoice.bankAccountHolder)}`,
        `IBAN: ${lineOrFallback(invoice.bankIban)}`,
        `BIC: ${lineOrFallback(invoice.bankBic)}${
          compact(invoice.bankName) ? ` (Bank: ${compact(invoice.bankName)})` : ""
        }`,
      ],
      rightLines: [lineOrFallback(transferPaymentNotice)],
    };
  }

  if (invoice.paymentMethod === "CASH") {
    return {
      title: cashPaymentTitle,
      leftLines: [lineOrFallback(cashPaymentNote)],
      rightLines: [],
    };
  }

  return {
    title: cardPaymentTitle,
    leftLines: [lineOrFallback(cardPaymentNote)],
    rightLines: [],
  };
}

export function buildInvoiceLayoutModel(invoice: InvoiceDTO): InvoiceLayoutModel {
  const senderAddress = `${compact(invoice.senderStreet)} ${compact(invoice.senderHouseNumber)}`.trim();
  const senderCityLine = `${compact(invoice.senderZipCode)} ${compact(invoice.senderCity)}`.trim();
  const recipientAddress = `${compact(invoice.recipientStreet)} ${compact(
    invoice.recipientHouseNumber,
  )}`.trim();
  const recipientCityLine = `${compact(invoice.recipientZipCode)} ${compact(
    invoice.recipientCity,
  )}`.trim();
  const serviceDateDisplay = invoice.serviceDate ?? invoice.appointmentDate ?? invoice.issueDate;
  const invoiceLabel = invoice.invoiceNumber ?? "Entwurf";
  const recipientLabel = normalizeInvoiceTextValue(invoice.recipientLabel, "Rechnung an:");
  const recipientName = compact(invoice.recipientName) || compact(invoice.customerName) || "Laufkundin";
  const items = deriveInvoiceItemsWithTotals(invoice);
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const discountCents = Math.max(0, subtotalCents - Math.max(invoice.totalCents, 0));
  const totalCents = subtotalCents;
  const payment = buildPaymentBlock(invoice);
  const legalNote = invoice.smallBusinessEnabled
    ? normalizeInvoiceTextValue(
        invoice.legalSmallBusinessNote,
        "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
      )
    : null;
  const closingText = normalizeInvoiceTextValue(
    invoice.closingText,
    "Vielen Dank für Ihren Besuch!",
  );
  const payableHint =
    invoice.paymentStatus === "PAID"
      ? "Bereits bezahlt"
      : invoice.dueDate
        ? `Zahlbar bis ${formatDate(invoice.dueDate)}`
        : "Zahlbar sofort";

  return {
    invoiceLabel,
    issueDate: formatDate(invoice.issueDate),
    serviceDate: formatDate(serviceDateDisplay),
    paymentMethodLabel: paymentMethodLabel(invoice.paymentMethod),
    customerNumberLabel: compact(invoice.customerNumber) || "—",
    senderLines: [
      lineOrFallback(invoice.senderBusinessName),
      compact(invoice.senderOwnerName),
      lineOrFallback(senderAddress),
      lineOrFallback(senderCityLine),
      compact(invoice.senderPhone) ? `Telefon: ${compact(invoice.senderPhone)}` : "",
      compact(invoice.senderEmail) ? `E-Mail: ${compact(invoice.senderEmail)}` : "",
      compact(invoice.senderTaxNumber)
        ? `Steuernummer: ${compact(invoice.senderTaxNumber)}`
        : "",
      compact(invoice.senderVatId) ? `USt-IdNr.: ${compact(invoice.senderVatId)}` : "",
    ].filter((line) => compact(line).length > 0),
    recipientLines: [
      recipientLabel,
      recipientName,
      compact(invoice.recipientAttention),
      compact(invoice.recipientLine2),
      compact(recipientAddress),
      compact(recipientCityLine),
      compact(invoice.recipientCountry),
      compact(invoice.recipientEmail),
    ].filter((line) => compact(line).length > 0),
    items: items.map((item) => ({
      id: item.id,
      position: item.position,
      service: item.service,
      description:
        compact(item.description) ||
        (compact(item.title) && compact(item.title) !== compact(item.service)
          ? compact(item.title)
          : ""),
      quantity: `${item.quantity}`,
      unitPrice: formatEuroFromCents(item.unitPriceCents),
      total: formatEuroFromCents(item.totalCents),
      unitPriceCents: item.unitPriceCents,
      totalCents: item.totalCents,
    })),
    subtotalCents,
    discountCents,
    totalCents,
    subtotalDisplay: formatEuroFromCents(subtotalCents),
    discountDisplay: `- ${formatEuroFromCents(discountCents)}`,
    totalDisplay: formatEuroFromCents(totalCents),
    payableHint,
    payment,
    legalNote: legalNote ? lineOrFallback(legalNote) : null,
    closingText: sanitizeFooterText(closingText),
    additionalFooterNote: sanitizeFooterText(compact(invoice.additionalFooterNote)),
  };
}
