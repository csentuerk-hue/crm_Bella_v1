import type { InvoiceDTO, PaymentMethod } from "@/types/crm";

export const SMALL_VALUE_INVOICE_THRESHOLD_CENTS = 25000;

export function requiresFullInvoiceAddress(totalCents: number): boolean {
  return totalCents > SMALL_VALUE_INVOICE_THRESHOLD_CENTS;
}

export function toInvoiceKind(
  totalCents: number,
): "KLEINBETRAGSRECHNUNG" | "VOLLRECHNUNG" {
  return requiresFullInvoiceAddress(totalCents)
    ? "VOLLRECHNUNG"
    : "KLEINBETRAGSRECHNUNG";
}

export function defaultPaymentStatusByMethod(
  paymentMethod: PaymentMethod,
): "OPEN" | "PAID" {
  if (paymentMethod === "CASH" || paymentMethod === "CARD") {
    return "PAID";
  }
  return "OPEN";
}

export type InvoiceLineValidationInput = {
  title: string | null | undefined;
  service: string | null | undefined;
  quantity: number;
  unitPriceCents: number;
};

export function validateInvoiceLineItems(
  items: InvoiceLineValidationInput[],
): string[] {
  if (items.length === 0) {
    return ["Bitte ergänze mindestens eine Position."];
  }

  const errors: string[] = [];
  for (const item of items) {
    const label = item.title?.trim() || item.service?.trim() || "";
    if (!label) {
      errors.push("Bitte ergänze eine Bezeichnung für jede Position.");
      break;
    }
    if (!(item.quantity > 0)) {
      errors.push("Bitte prüfe die Menge jeder Position.");
      break;
    }
    if (item.unitPriceCents < 0) {
      errors.push("Bitte prüfe den Einzelpreis jeder Position.");
      break;
    }
  }

  const hasAnyPricedItem = items.some((item) => item.unitPriceCents > 0);
  if (!hasAnyPricedItem) {
    errors.push("Für diese Rechnung fehlt noch ein Preis.");
  }

  return errors;
}

export type FinalizationRecipientInput = {
  recipientName: string;
  recipientStreet: string;
  recipientHouseNumber: string;
  recipientZipCode: string;
  recipientCity: string;
};

export function validateInvoiceFinalizationData(input: {
  totalCents: number;
  lines: InvoiceLineValidationInput[];
  recipient: FinalizationRecipientInput;
  paymentMethod: PaymentMethod;
  bankAccountHolder: string;
  bankIban: string;
}): string[] {
  const errors = validateInvoiceLineItems(input.lines);

  if (requiresFullInvoiceAddress(input.totalCents)) {
    if (
      !input.recipient.recipientName.trim() ||
      !input.recipient.recipientStreet.trim() ||
      !input.recipient.recipientHouseNumber.trim() ||
      !input.recipient.recipientZipCode.trim() ||
      !input.recipient.recipientCity.trim()
    ) {
      errors.push(
        "Für Beträge über 250 € wird eine vollständige Kundenadresse benötigt.",
      );
    }
  }

  if (input.paymentMethod === "BANK_TRANSFER") {
    if (!input.bankAccountHolder.trim() || !input.bankIban.trim()) {
      errors.push(
        "Für Überweisung fehlen Kontoinhaber oder IBAN in den Rechnungseinstellungen.",
      );
    }
  }

  return errors;
}

export function toLifecycleStatusFromDocumentStatus(
  documentStatus: InvoiceDTO["documentStatus"],
): "ENTWURF" | "FINALISIERT" {
  return documentStatus === "DRAFT" ? "ENTWURF" : "FINALISIERT";
}
