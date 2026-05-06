export const TEST_INVOICE_CONFIRMATION_TEXT = "DELETE TEST INVOICES";
export const TEST_INVOICE_ACTION_LABEL = "Nur Testrechnungen bereinigen";

const NAME_MARKERS = [
  "test",
  "demo",
  "max mustermann",
  "musterfrau",
  "agnc",
  "agnc events",
  "laufkundin",
];

const EMAIL_MARKERS = ["test@", "demo@", "example@", "agnc.events"];

const STRICT_LINE_ITEM_MARKERS = [
  "testleistung",
  "demo",
  "musterleistung",
  "studio komplettpaket",
  "refill (test)",
];

const LASH_SHAMPOO_MARKER = "lash shampoo";
const STALE_CLOSING_TEXT_MARKER = "aktualisierter abschlusstext";
const TIMESTAMP_SUFFIX_PATTERN = /[\(\[]\s*\d{10,}\s*[\)\]]/;
const KNOWN_TEST_INVOICE_NUMBER_PATTERN = /^bbs-2026-00(0[4-9]|[1-4][0-9]|5[0-2])(?:\.|$)/;

export type TestInvoiceDetectionInput = {
  id: string;
  invoiceNumber: string | null;
  amountCents: number;
  customerId: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientAttention: string;
  recipientLine2: string;
  recipientNotes: string;
  closingText: string;
  additionalFooterNote: string;
  customer: { name: string; email: string | null } | null;
  items: Array<{
    title: string | null;
    description: string | null;
    service: string;
  }>;
};

export type TestInvoiceCandidate = {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  amountCents: number;
  reasons: string[];
};

export type TestInvoiceSkipped = {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  amountCents: number;
  reason: string;
};

export type TestInvoiceClassification = {
  candidates: TestInvoiceCandidate[];
  skipped: TestInvoiceSkipped[];
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").toString().trim().toLowerCase();
}

function compact(value: string | null | undefined): string {
  return (value ?? "").toString().trim();
}

function matchMarkers(value: string, markers: string[]) {
  return markers.filter((marker) => value.includes(marker));
}

function invoiceLabel(invoiceNumber: string | null, id: string) {
  return compact(invoiceNumber) || `Entwurf-${id.slice(-6)}`;
}

function classifyInvoice(invoice: TestInvoiceDetectionInput) {
  const reasons: string[] = [];
  const weakReasons: string[] = [];

  const nameBlob = normalize(
    [invoice.customer?.name, invoice.recipientName, invoice.recipientAttention, invoice.recipientLine2]
      .filter(Boolean)
      .join(" "),
  );
  const emailBlob = normalize([invoice.customer?.email, invoice.recipientEmail].filter(Boolean).join(" "));
  const itemBlob = normalize(
    (invoice.items || [])
      .flatMap((item) => [item.title, item.description, item.service])
      .filter(Boolean)
      .join(" "),
  );
  const footerBlob = normalize(
    [invoice.closingText, invoice.additionalFooterNote, invoice.recipientNotes]
      .filter(Boolean)
      .join(" "),
  );

  const matchedNameMarkers = matchMarkers(nameBlob, NAME_MARKERS);
  const matchedEmailMarkers = matchMarkers(emailBlob, EMAIL_MARKERS);
  const matchedStrictLineMarkers = matchMarkers(itemBlob, STRICT_LINE_ITEM_MARKERS);

  if (matchedNameMarkers.length > 0) {
    reasons.push(`Empfänger-/Kundinnenname enthält Testmarker (${matchedNameMarkers.join(", ")}).`);
  }
  if (matchedEmailMarkers.length > 0) {
    reasons.push(`Empfänger-/Kundinnen-E-Mail enthält Testmarker (${matchedEmailMarkers.join(", ")}).`);
  }
  if (matchedStrictLineMarkers.length > 0) {
    reasons.push(
      `Rechnungsposition enthält Platzhalter/Testinhalt (${matchedStrictLineMarkers.join(", ")}).`,
    );
  }

  const hasPrimarySignal =
    matchedNameMarkers.length > 0 ||
    matchedEmailMarkers.length > 0 ||
    matchedStrictLineMarkers.length > 0;

  const hasStaleClosingText = footerBlob.includes(STALE_CLOSING_TEXT_MARKER);

  const hasTimestampSuffix = TIMESTAMP_SUFFIX_PATTERN.test(
    [invoice.closingText, invoice.additionalFooterNote].filter(Boolean).join(" "),
  );

  const isStandalone = !invoice.customerId;
  if (hasStaleClosingText) {
    if (hasPrimarySignal || isStandalone) {
      reasons.push("Abschlusstext/Fußnote enthält 'Aktualisierter Abschlusstext'.");
    } else {
      weakReasons.push("Nur Abschlusstext/Fußnote enthält 'Aktualisierter Abschlusstext'.");
    }
  }
  if (hasTimestampSuffix) {
    if (hasPrimarySignal || isStandalone) {
      reasons.push("Abschlusstext/Fußnote enthält Zeitstempel-Suffix in Klammern.");
    } else {
      weakReasons.push("Nur Zeitstempel-Suffix in Abschlusstext/Fußnote erkannt.");
    }
  }

  const hasArtificialStandaloneSignal =
    isStandalone &&
    (matchedNameMarkers.length > 0 ||
      matchedEmailMarkers.length > 0 ||
      matchedStrictLineMarkers.length > 0 ||
      hasStaleClosingText ||
      hasTimestampSuffix);
  if (hasArtificialStandaloneSignal) {
    reasons.push("Freie Rechnung ohne echte Kundinnenzuordnung mit Test-/Demo-Signalen.");
  }

  const hasLashShampoo = itemBlob.includes(LASH_SHAMPOO_MARKER);
  if (hasLashShampoo) {
    const hasTestContext =
      matchedNameMarkers.length > 0 ||
      matchedEmailMarkers.length > 0 ||
      hasStaleClosingText ||
      hasTimestampSuffix ||
      isStandalone;
    if (hasTestContext) {
      reasons.push("Position enthält 'Lash Shampoo' im Testkontext.");
    } else {
      weakReasons.push("Nur 'Lash Shampoo' ohne weitere Testmerkmale.");
    }
  }

  const normalizedInvoiceNumber = normalize(invoice.invoiceNumber);
  if (
    normalizedInvoiceNumber &&
    KNOWN_TEST_INVOICE_NUMBER_PATTERN.test(normalizedInvoiceNumber) &&
    (matchedNameMarkers.length > 0 ||
      matchedEmailMarkers.length > 0 ||
      matchedStrictLineMarkers.length > 0 ||
      hasStaleClosingText ||
      hasTimestampSuffix ||
      isStandalone)
  ) {
    reasons.push("Rechnungsnummer liegt im bekannten Testbereich mit zusätzlichen Testmerkmalen.");
  }

  return {
    reasons,
    weakOnlyReason: weakReasons.length > 0 ? weakReasons.join(" | ") : null,
  };
}

export function classifyTestInvoices(
  invoices: TestInvoiceDetectionInput[],
): TestInvoiceClassification {
  const candidates: TestInvoiceCandidate[] = [];
  const skipped: TestInvoiceSkipped[] = [];

  for (const invoice of invoices) {
    const { reasons, weakOnlyReason } = classifyInvoice(invoice);
    const label = invoiceLabel(invoice.invoiceNumber, invoice.id);
    const recipient =
      compact(invoice.recipientName) || compact(invoice.customer?.name) || "Ohne Empfänger";

    if (reasons.length > 0) {
      candidates.push({
        id: invoice.id,
        invoiceNumber: label,
        recipientName: recipient,
        amountCents: invoice.amountCents,
        reasons,
      });
      continue;
    }

    if (weakOnlyReason) {
      skipped.push({
        id: invoice.id,
        invoiceNumber: label,
        recipientName: recipient,
        amountCents: invoice.amountCents,
        reason: weakOnlyReason,
      });
    }
  }

  return { candidates, skipped };
}
