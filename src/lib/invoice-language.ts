const LEGACY_INVOICE_TEXT_MAP: Record<string, string> = {
  "Invoice to:": "Rechnung an:",
  "Payment method: Bank transfer": "Zahlungsart: Überweisung",
  "Please transfer the amount within {X} business days.":
    "Zahlungsziel: innerhalb der nächsten {X} Werktage.",
  "Payment method: Cash": "Zahlungsart: Barzahlung",
  "The amount was paid in cash.": "Der Betrag wurde in bar beglichen.",
  "Payment method: Card payment": "Zahlungsart: Kartenzahlung",
  "The amount was paid by card.": "Der Betrag wurde per Kartenzahlung beglichen.",
  "According to § 19 UStG, no VAT is charged.":
    "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
  "Thank you for your visit!": "Vielen Dank für Ihren Besuch!",

  "Zahlungsart: Ueberweisung": "Zahlungsart: Überweisung",
  "Bitte ueberweisen Sie den Betrag innerhalb von {X} Werktagen.":
    "Zahlungsziel: innerhalb der nächsten {X} Werktage.",
  "Gemaess § 19 UStG wird keine Umsatzsteuer berechnet.":
    "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
  "Vielen Dank fuer Ihren Besuch!": "Vielen Dank für Ihren Besuch!",
};

function repairMojibake(input: string): string {
  return input
    .replaceAll("ÃƒÅ“", "Ü")
    .replaceAll("ÃƒÂ¼", "ü")
    .replaceAll("ÃƒÂ¤", "ä")
    .replaceAll("ÃƒÂ¶", "ö")
    .replaceAll("ÃƒÅ¸", "ß")
    .replaceAll("Ãœ", "Ü")
    .replaceAll("Ã¼", "ü")
    .replaceAll("Ã¤", "ä")
    .replaceAll("Ã¶", "ö")
    .replaceAll("ÃŸ", "ß")
    .replaceAll("Â§", "§")
    .replaceAll("Ã‚Â§", "§")
    .replaceAll("Ueberweisung", "Überweisung")
    .replaceAll("ueberweisen", "überweisen")
    .replaceAll("Gemaess", "Gemäß")
    .replaceAll("fuer", "für")
    .replaceAll("Empfaenger", "Empfänger")
    .replaceAll("Strasse", "Straße");
}

export function normalizeInvoiceTextValue(value: string, fallback: string): string {
  const normalized = value.trim();
  const base = normalized.length > 0 ? normalized : fallback;
  const mapped = LEGACY_INVOICE_TEXT_MAP[base] ?? base;
  return repairMojibake(mapped);
}
