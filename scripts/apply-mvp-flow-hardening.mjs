import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Expected source fragment not found: ${label}`);
  }
  return source.replace(search, replacement);
}

const appointmentsPath = "src/app/(crm)/appointments/page.tsx";
const invoicesPath = "src/app/(crm)/invoices/page.tsx";
const archivePath = "src/app/(crm)/invoices/archive/page.tsx";

let appointments = readFileSync(appointmentsPath, "utf8");
appointments = replaceRequired(
  appointments,
  'const DEFAULT_PAYMENT_METHOD: PaymentMethod = "BANK_TRANSFER";',
  'const DEFAULT_PAYMENT_METHOD: PaymentMethod = "CASH";',
  "appointment invoice default payment method",
);
writeFileSync(appointmentsPath, appointments);

let invoices = readFileSync(invoicesPath, "utf8");
invoices = replaceRequired(
  invoices,
  `const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [\n  { value: "BANK_TRANSFER", label: "Überweisung" },\n  { value: "CASH", label: "Barzahlung" },\n];`,
  `const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [\n  { value: "CASH", label: "Barzahlung" },\n  { value: "CARD", label: "Kartenzahlung" },\n  { value: "BANK_TRANSFER", label: "Überweisung" },\n];`,
  "invoice payment method options",
);
invoices = replaceRequired(
  invoices,
  `    paymentMethod:\n      invoice.paymentMethod === "CASH" || invoice.paymentMethod === "BANK_TRANSFER"\n        ? invoice.paymentMethod\n        : "CASH",`,
  `    paymentMethod: invoice.paymentMethod,`,
  "invoice editor payment method mapping",
);
invoices = replaceRequired(
  invoices,
  `function buildInvoicePdfHref(invoice: InvoiceDTO): string {\n  const params = new URLSearchParams();\n  if (invoice.invoiceNumber) {\n    params.set("invoiceNumber", invoice.invoiceNumber);\n  }\n  params.set("download", "true");\n  return \`/api/invoices/\${invoice.id}/pdf?\${params.toString()}\`;\n}\n`,
  `function buildInvoicePdfHref(invoice: InvoiceDTO): string {\n  const params = new URLSearchParams();\n  if (invoice.invoiceNumber) {\n    params.set("invoiceNumber", invoice.invoiceNumber);\n  }\n  params.set("download", "true");\n  return \`/api/invoices/\${invoice.id}/pdf?\${params.toString()}\`;\n}\n\nfunction isInvoiceFinalized(invoice: InvoiceDTO | null): boolean {\n  if (!invoice) {\n    return false;\n  }\n  return invoice.lifecycleStatus === "FINALISIERT" || invoice.documentStatus !== "DRAFT";\n}\n`,
  "invoice finalized helper insertion",
);
invoices = replaceRequired(
  invoices,
  '  const isSelectedInvoiceFinalized = selectedInvoice?.lifecycleStatus === "FINALISIERT";',
  '  const isSelectedInvoiceFinalized = isInvoiceFinalized(selectedInvoice);',
  "workspace finalized state",
);
invoices = replaceRequired(
  invoices,
  '        if (requestedInvoiceId && fetchedExternal && fetchedExternal.lifecycleStatus === "FINALISIERT") {',
  '        if (requestedInvoiceId && fetchedExternal && isInvoiceFinalized(fetchedExternal)) {',
  "external finalized notice",
);
invoices = replaceRequired(
  invoices,
  '    if (selectedInvoice.lifecycleStatus !== "ENTWURF") {',
  '    if (isInvoiceFinalized(selectedInvoice)) {',
  "persist finalized guard",
);
invoices = replaceRequired(
  invoices,
  '    if (!selectedInvoice || selectedInvoice.lifecycleStatus !== "ENTWURF") {',
  '    if (!selectedInvoice || isInvoiceFinalized(selectedInvoice)) {',
  "delete finalized guard",
);
invoices = replaceRequired(
  invoices,
  '{externalInvoice && externalInvoice.lifecycleStatus !== "ENTWURF" && (',
  '{externalInvoice && isInvoiceFinalized(externalInvoice) && (',
  "external finalized select entry",
);
invoices = replaceRequired(
  invoices,
  '{selectedInvoice.lifecycleStatus === "ENTWURF" && (',
  '{!isSelectedInvoiceFinalized && (',
  "draft delete action visibility",
);
invoices = replaceRequired(
  invoices,
  `                              paymentStatus:\n                                event.target.value === "CASH" ? "PAID" : current.paymentStatus,`,
  `                              paymentStatus:\n                                event.target.value === "BANK_TRANSFER" ? "OPEN" : "PAID",`,
  "payment status on payment method change",
);
writeFileSync(invoicesPath, invoices);

let archive = readFileSync(archivePath, "utf8");
archive = replaceRequired(
  archive,
  `                    >\n                      Bearbeiten\n                    </Link>`,
  `                    >\n                      {invoice.lifecycleStatus === "FINALISIERT" || invoice.documentStatus !== "DRAFT"\n                        ? "Ansehen"\n                        : "Bearbeiten"}\n                    </Link>`,
  "archive finalized action label",
);
writeFileSync(archivePath, archive);

// Keep the repository clean after this one-shot patch has executed.
for (const path of [
  "scripts/apply-mvp-flow-hardening.mjs",
  ".github/workflows/mvp-flow-hardening-once.yml",
]) {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
