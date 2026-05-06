import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

function loadEnvFile(filePath, override) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const valueRaw = line.slice(separator + 1).trim();
    const value = valueRaw.replace(/^"(.*)"$/, "$1");
    if (override || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env"), false);
loadEnvFile(path.join(process.cwd(), ".env.local"), true);

const execute = process.argv.includes("--execute");
const invoicesOnly = process.argv.includes("--invoices-only");
const confirmIndex = process.argv.findIndex((arg) => arg === "--confirm");
const confirmValue =
  confirmIndex >= 0 && process.argv.length > confirmIndex + 1
    ? process.argv[confirmIndex + 1]
    : "";

const prisma = new PrismaClient();

const CUSTOMER_NAME_MARKERS = [
  "test",
  "demo",
  "max mustermann",
  "agnc",
  "laufkundin",
  "playwright",
  "codex",
  "json stabil kundin",
  "freeinvoice kundin",
  "layout konsistenz kundin",
  "ui kundin",
  "archiv test",
];

const EMAIL_MARKERS = ["test@", "example@", "demo@", "playwright", "codex", "mock", "seed"];

const PLACEHOLDER_MARKERS = [
  "testleistung",
  "demo",
  "refill (test)",
  "playwright",
  "codex",
  "mock",
  "seed",
  "json stabil",
  "freeinvoice kundin",
  "layout konsistenz",
  "laufkundin",
];

const TEST_INVOICE_CONFIRMATION_TEXT = "DELETE TEST INVOICES";
const TEST_INVOICE_ACTION_LABEL = "Nur Testrechnungen bereinigen";

const INVOICE_NAME_MARKERS = [
  "test",
  "demo",
  "max mustermann",
  "musterfrau",
  "agnc",
  "agnc events",
  "laufkundin",
];

const INVOICE_EMAIL_MARKERS = ["test@", "demo@", "example@", "agnc.events"];

const INVOICE_STRICT_LINE_MARKERS = [
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

function normalize(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function compact(value) {
  return (value ?? "").toString().trim();
}

function hasMarker(value, markers) {
  const v = normalize(value);
  if (!v) return false;
  return markers.some((m) => v.includes(m));
}

function lacksMeaningfulData(customer) {
  const fields = [
    customer.email,
    customer.phone,
    customer.street,
    customer.houseNumber,
    customer.postalCode,
    customer.city,
    customer.invoiceRecipientName,
    customer.invoiceEmail,
  ];
  const hasAny = fields.some((v) => normalize(v).length > 0);
  if (hasAny) return false;

  const n = normalize(customer.name);
  const genericName = n.includes("kundin") || n.includes("kunde") || /\d{6,}/.test(n);
  return genericName;
}

function looksLikeTestCustomer(customer) {
  const byName = hasMarker(customer.name, CUSTOMER_NAME_MARKERS);
  const byEmail = hasMarker(customer.email, EMAIL_MARKERS);
  const byMissingData = lacksMeaningfulData(customer);
  return byName || byEmail || byMissingData;
}

function invoiceLooksPlaceholder(invoice) {
  const textBlob = [
    invoice.invoiceNumber,
    invoice.recipientName,
    invoice.recipientAttention,
    invoice.recipientLine2,
    invoice.recipientNotes,
    ...(invoice.items ?? []).flatMap((item) => [
      item.title,
      item.description,
      item.service,
    ]),
  ]
    .map((v) => normalize(v))
    .join(" ");

  return PLACEHOLDER_MARKERS.some((marker) => textBlob.includes(marker));
}

function invoiceLabel(invoiceNumber, id) {
  return compact(invoiceNumber) || `Entwurf-${id.slice(-6)}`;
}

function matchMarkers(value, markers) {
  return markers.filter((marker) => value.includes(marker));
}

function classifyInvoiceForInvoiceOnlyCleanup(invoice) {
  const reasons = [];
  const weakReasons = [];

  const nameBlob = normalize(
    [
      invoice.customer?.name,
      invoice.recipientName,
      invoice.recipientAttention,
      invoice.recipientLine2,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const emailBlob = normalize(
    [invoice.customer?.email, invoice.recipientEmail].filter(Boolean).join(" "),
  );
  const itemBlob = normalize(
    (invoice.items ?? [])
      .flatMap((item) => [item.title, item.description, item.service])
      .filter(Boolean)
      .join(" "),
  );
  const footerBlob = normalize(
    [invoice.closingText, invoice.additionalFooterNote, invoice.recipientNotes]
      .filter(Boolean)
      .join(" "),
  );

  const matchedNameMarkers = matchMarkers(nameBlob, INVOICE_NAME_MARKERS);
  const matchedEmailMarkers = matchMarkers(emailBlob, INVOICE_EMAIL_MARKERS);
  const matchedStrictLineMarkers = matchMarkers(itemBlob, INVOICE_STRICT_LINE_MARKERS);

  if (matchedNameMarkers.length > 0) {
    reasons.push(
      `Empfaenger-/Kundinnenname enthaelt Testmarker (${matchedNameMarkers.join(", ")}).`,
    );
  }
  if (matchedEmailMarkers.length > 0) {
    reasons.push(
      `Empfaenger-/Kundinnen-E-Mail enthaelt Testmarker (${matchedEmailMarkers.join(", ")}).`,
    );
  }
  if (matchedStrictLineMarkers.length > 0) {
    reasons.push(
      `Rechnungsposition enthaelt Platzhalter/Testinhalt (${matchedStrictLineMarkers.join(", ")}).`,
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
      reasons.push("Abschlusstext/Fussnote enthaelt 'Aktualisierter Abschlusstext'.");
    } else {
      weakReasons.push("Nur Abschlusstext/Fussnote enthaelt 'Aktualisierter Abschlusstext'.");
    }
  }

  if (hasTimestampSuffix) {
    if (hasPrimarySignal || isStandalone) {
      reasons.push("Abschlusstext/Fussnote enthaelt Zeitstempel-Suffix in Klammern.");
    } else {
      weakReasons.push("Nur Zeitstempel-Suffix in Abschlusstext/Fussnote erkannt.");
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
      reasons.push("Position enthaelt 'Lash Shampoo' im Testkontext.");
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
    reasons.push("Rechnungsnummer liegt im bekannten Testbereich mit zusaetzlichen Testmerkmalen.");
  }

  return {
    reasons,
    weakOnlyReason: weakReasons.length > 0 ? weakReasons.join(" | ") : null,
  };
}

function classifyInvoicesForInvoiceOnlyCleanup(invoices) {
  const candidates = [];
  const skipped = [];

  for (const invoice of invoices) {
    const { reasons, weakOnlyReason } = classifyInvoiceForInvoiceOnlyCleanup(invoice);
    const recipientName =
      compact(invoice.recipientName) || compact(invoice.customer?.name) || "Ohne Empfaenger";
    const invoiceNumber = invoiceLabel(invoice.invoiceNumber, invoice.id);
    const amountCents = invoice.totalCents || invoice.amountCents || 0;

    if (reasons.length > 0) {
      candidates.push({
        id: invoice.id,
        invoiceNumber,
        recipientName,
        amountCents,
        reasons,
      });
      continue;
    }

    if (weakOnlyReason) {
      skipped.push({
        id: invoice.id,
        invoiceNumber,
        recipientName,
        amountCents,
        reason: weakOnlyReason,
      });
    }
  }

  return { candidates, skipped };
}

async function main() {
  const invoiceCleanupSource = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      amountCents: true,
      totalCents: true,
      customerId: true,
      recipientName: true,
      recipientEmail: true,
      recipientAttention: true,
      recipientLine2: true,
      recipientNotes: true,
      closingText: true,
      additionalFooterNote: true,
      customer: {
        select: {
          name: true,
          email: true,
        },
      },
      items: {
        select: {
          title: true,
          description: true,
          service: true,
        },
      },
    },
  });

  const invoiceOnlyClassification =
    classifyInvoicesForInvoiceOnlyCleanup(invoiceCleanupSource);

  if (invoicesOnly) {
    if (!execute) {
      console.log(
        JSON.stringify(
          {
            mode: "dry-run",
            actionLabel: TEST_INVOICE_ACTION_LABEL,
            requiredConfirmation: TEST_INVOICE_CONFIRMATION_TEXT,
            invoicesToDelete: invoiceOnlyClassification.candidates.length,
            skippedInvoices: invoiceOnlyClassification.skipped.length,
            dryRunInvoices: invoiceOnlyClassification.candidates.map((invoice) => ({
              invoiceNumber: invoice.invoiceNumber,
              recipientName: invoice.recipientName,
              amountCents: invoice.amountCents,
              reason: invoice.reasons.join(" | "),
            })),
            skipped: invoiceOnlyClassification.skipped,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (confirmValue !== TEST_INVOICE_CONFIRMATION_TEXT) {
      console.log(
        JSON.stringify(
          {
            mode: "execute",
            error:
              "Bestaetigung fehlt. Fuehre mit --confirm \"DELETE TEST INVOICES\" aus.",
            requiredConfirmation: TEST_INVOICE_CONFIRMATION_TEXT,
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }

    const invoiceIds = invoiceOnlyClassification.candidates.map((invoice) => invoice.id);

    const result = await prisma.$transaction(async (tx) => {
      const deletedLineItems = await tx.invoiceItem.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
      const deletedInvoices = await tx.invoice.deleteMany({
        where: { id: { in: invoiceIds } },
      });
      return {
        deletedLineItems: deletedLineItems.count,
        deletedInvoices: deletedInvoices.count,
      };
    });

    console.log(
      JSON.stringify(
        {
          mode: "execute",
          actionLabel: TEST_INVOICE_ACTION_LABEL,
          deletedInvoices: result.deletedInvoices,
          deletedLineItems: result.deletedLineItems,
          deletedInvoiceNumbers: invoiceOnlyClassification.candidates.map(
            (invoice) => invoice.invoiceNumber,
          ),
          skipped: invoiceOnlyClassification.skipped,
        },
        null,
        2,
      ),
    );
    return;
  }

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
      invoiceRecipientName: true,
      invoiceEmail: true,
    },
  });

  const testCustomers = customers.filter(looksLikeTestCustomer);
  const testCustomerIds = new Set(testCustomers.map((c) => c.id));

  const legacyLinkedInvoices = invoiceCleanupSource.filter(
    (i) => i.customerId && testCustomerIds.has(i.customerId),
  );
  const legacyStandalonePlaceholderInvoices = invoiceCleanupSource.filter(
    (i) => !i.customerId && invoiceLooksPlaceholder(i),
  );

  const invoiceIdsToDelete = new Set([
    ...legacyLinkedInvoices.map((i) => i.id),
    ...legacyStandalonePlaceholderInvoices.map((i) => i.id),
  ]);

  const customerIdsToDelete = Array.from(testCustomerIds);

  const appointmentsToDelete = await prisma.appointment.findMany({
    where: {
      customerId: { in: customerIdsToDelete },
    },
    select: { id: true },
  });
  const appointmentIdsToDelete = appointmentsToDelete.map((a) => a.id);

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          customersToDelete: customerIdsToDelete.length,
          invoicesToDelete: invoiceIdsToDelete.size,
          appointmentsToDelete: appointmentIdsToDelete.length,
          sampleCustomers: testCustomers.slice(0, 10).map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
          })),
          sampleInvoices: invoiceCleanupSource
            .filter((i) => invoiceIdsToDelete.has(i.id))
            .slice(0, 10)
            .map((i) => ({
              id: i.id,
              customerId: i.customerId,
              invoiceNumber: i.invoiceNumber,
              recipientName: i.recipientName,
            })),
          invoiceOnlyDryRun: invoiceOnlyClassification.candidates.slice(0, 20).map((invoice) => ({
            invoiceNumber: invoice.invoiceNumber,
            recipientName: invoice.recipientName,
            amountCents: invoice.amountCents,
            reasons: invoice.reasons,
          })),
          invoiceOnlySkipped: invoiceOnlyClassification.skipped.slice(0, 20),
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const deletedLineItems = await tx.invoiceItem.deleteMany({
      where: {
        invoiceId: { in: Array.from(invoiceIdsToDelete) },
      },
    });

    const deletedInvoices = await tx.invoice.deleteMany({
      where: { id: { in: Array.from(invoiceIdsToDelete) } },
    });

    const deletedAppointments = await tx.appointment.deleteMany({
      where: { id: { in: appointmentIdsToDelete } },
    });

    const deletedCustomers = await tx.customer.deleteMany({
      where: { id: { in: customerIdsToDelete } },
    });

    return {
      deletedInvoices: deletedInvoices.count,
      deletedLineItems: deletedLineItems.count,
      deletedAppointments: deletedAppointments.count,
      deletedCustomers: deletedCustomers.count,
    };
  });

  console.log(
    JSON.stringify(
      {
        mode: "execute",
        ...result,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
