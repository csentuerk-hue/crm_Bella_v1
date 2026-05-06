import type { InvoiceSettings } from "@prisma/client";

import { injectBusinessDayPlaceholder } from "@/lib/invoice-settings";
import { normalizeInvoiceTextValue } from "@/lib/invoice-language";
import type { InvoiceDTO } from "@/types/crm";

export function applyInvoiceSettingsFallback(
  invoice: InvoiceDTO,
  settings: InvoiceSettings,
): InvoiceDTO {
  const closingText = normalizeInvoiceTextValue(
    settings.closingText,
    "Vielen Dank für Ihren Besuch!",
  );

  return {
    ...invoice,
    bankAccountHolder: invoice.bankAccountHolder.trim() || settings.bankAccountHolder,
    bankIban: invoice.bankIban.trim() || settings.bankIban,
    bankBic: invoice.bankBic.trim() || settings.bankBic,
    bankName: invoice.bankName.trim() || settings.bankName,
    transferPaymentTitle:
      invoice.transferPaymentTitle.trim() || settings.transferPaymentTitle,
    transferPaymentNotice:
      invoice.transferPaymentNotice.trim() ||
      injectBusinessDayPlaceholder(
        settings.transferPaymentNotice,
        settings.defaultPaymentDeadlineBusinessDays,
      ),
    cashPaymentTitle: invoice.cashPaymentTitle.trim() || settings.cashPaymentTitle,
    cashPaymentNote: invoice.cashPaymentNote.trim() || settings.cashPaymentNote,
    cardPaymentTitle: invoice.cardPaymentTitle.trim() || settings.cardPaymentTitle,
    cardPaymentNote: invoice.cardPaymentNote.trim() || settings.cardPaymentNote,
    closingText,
    additionalFooterNote: settings.additionalFooterNote.trim(),
  };
}
