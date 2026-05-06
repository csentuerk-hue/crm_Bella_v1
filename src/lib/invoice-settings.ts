import type { InvoiceSettings, Prisma, PrismaClient } from "@prisma/client";

import { normalizeInvoiceTextValue } from "@/lib/invoice-language";
import type { InvoiceSettingsDTO } from "@/types/crm";

type PrismaLikeClient = Prisma.TransactionClient | PrismaClient;

export const DEFAULT_INVOICE_SETTINGS_INPUT = {
  businessName: "Bella by Sobiella",
  ownerName: "",
  street: "",
  houseNumber: "",
  zipCode: "",
  city: "",
  phone: "",
  email: "",
  taxNumber: "",
  vatId: "",
  bankAccountHolder: "",
  bankIban: "",
  bankBic: "",
  bankName: "",
  smallBusinessEnabled: true,
  defaultPaymentDeadlineBusinessDays: 10,
  defaultCurrency: "EUR",
  defaultPaymentMethod: "CASH" as const,
  invoicePrefix: "BBS",
  recipientLabel: "Rechnung an:",
  transferPaymentTitle: "Zahlungsart: Überweisung",
  transferPaymentNotice: "Zahlungsziel: innerhalb der nächsten {X} Werktage.",
  cashPaymentTitle: "Zahlungsart: Barzahlung",
  cashPaymentNote: "Der Betrag wurde in bar beglichen.",
  cardPaymentTitle: "Zahlungsart: Kartenzahlung",
  cardPaymentNote: "Der Betrag wurde per Kartenzahlung beglichen.",
  legalSmallBusinessNote: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
  closingText: "Vielen Dank für Ihren Besuch!",
  additionalFooterNote: "",
};

export async function getOrCreateInvoiceSettings(client: PrismaLikeClient): Promise<InvoiceSettings> {
  const existing = await client.invoiceSettings.findUnique({ where: { id: "default" } });
  if (existing) {
    const normalizedValues = {
      recipientLabel: normalizeInvoiceTextValue(existing.recipientLabel, DEFAULT_INVOICE_SETTINGS_INPUT.recipientLabel),
      transferPaymentTitle: normalizeInvoiceTextValue(
        existing.transferPaymentTitle,
        DEFAULT_INVOICE_SETTINGS_INPUT.transferPaymentTitle,
      ),
      transferPaymentNotice: normalizeInvoiceTextValue(
        existing.transferPaymentNotice,
        DEFAULT_INVOICE_SETTINGS_INPUT.transferPaymentNotice,
      ),
      cashPaymentTitle: normalizeInvoiceTextValue(
        existing.cashPaymentTitle,
        DEFAULT_INVOICE_SETTINGS_INPUT.cashPaymentTitle,
      ),
      cashPaymentNote: normalizeInvoiceTextValue(existing.cashPaymentNote, DEFAULT_INVOICE_SETTINGS_INPUT.cashPaymentNote),
      cardPaymentTitle: normalizeInvoiceTextValue(
        existing.cardPaymentTitle,
        DEFAULT_INVOICE_SETTINGS_INPUT.cardPaymentTitle,
      ),
      cardPaymentNote: normalizeInvoiceTextValue(existing.cardPaymentNote, DEFAULT_INVOICE_SETTINGS_INPUT.cardPaymentNote),
      legalSmallBusinessNote: normalizeInvoiceTextValue(
        existing.legalSmallBusinessNote,
        DEFAULT_INVOICE_SETTINGS_INPUT.legalSmallBusinessNote,
      ),
      closingText: normalizeInvoiceTextValue(existing.closingText, DEFAULT_INVOICE_SETTINGS_INPUT.closingText),
    };

    const shouldUpdate =
      normalizedValues.recipientLabel !== existing.recipientLabel ||
      normalizedValues.transferPaymentTitle !== existing.transferPaymentTitle ||
      normalizedValues.transferPaymentNotice !== existing.transferPaymentNotice ||
      normalizedValues.cashPaymentTitle !== existing.cashPaymentTitle ||
      normalizedValues.cashPaymentNote !== existing.cashPaymentNote ||
      normalizedValues.cardPaymentTitle !== existing.cardPaymentTitle ||
      normalizedValues.cardPaymentNote !== existing.cardPaymentNote ||
      normalizedValues.legalSmallBusinessNote !== existing.legalSmallBusinessNote ||
      normalizedValues.closingText !== existing.closingText;

    if (!shouldUpdate) {
      return existing;
    }

    return client.invoiceSettings.update({
      where: { id: "default" },
      data: normalizedValues,
    });
  }

  return client.invoiceSettings.create({
    data: {
      id: "default",
      ...DEFAULT_INVOICE_SETTINGS_INPUT,
    },
  });
}

export function toInvoiceSettingsDTO(settings: InvoiceSettings): InvoiceSettingsDTO {
  return {
    businessName: settings.businessName,
    ownerName: settings.ownerName,
    street: settings.street,
    houseNumber: settings.houseNumber,
    zipCode: settings.zipCode,
    city: settings.city,
    phone: settings.phone,
    email: settings.email,
    taxNumber: settings.taxNumber,
    vatId: settings.vatId,
    bankAccountHolder: settings.bankAccountHolder,
    bankIban: settings.bankIban,
    bankBic: settings.bankBic,
    bankName: settings.bankName,
    smallBusinessEnabled: settings.smallBusinessEnabled,
    defaultPaymentDeadlineBusinessDays: settings.defaultPaymentDeadlineBusinessDays,
    defaultCurrency: settings.defaultCurrency,
    defaultPaymentMethod: settings.defaultPaymentMethod,
    invoicePrefix: settings.invoicePrefix,
    recipientLabel: settings.recipientLabel,
    transferPaymentTitle: settings.transferPaymentTitle,
    transferPaymentNotice: settings.transferPaymentNotice,
    cashPaymentTitle: settings.cashPaymentTitle,
    cashPaymentNote: settings.cashPaymentNote,
    cardPaymentTitle: settings.cardPaymentTitle,
    cardPaymentNote: settings.cardPaymentNote,
    legalSmallBusinessNote: settings.legalSmallBusinessNote,
    closingText: settings.closingText,
    additionalFooterNote: settings.additionalFooterNote,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export function injectBusinessDayPlaceholder(template: string, days: number): string {
  return template.replaceAll("{X}", String(days));
}

