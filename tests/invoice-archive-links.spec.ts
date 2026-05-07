import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

function readArchivePageSource() {
  const filePath = path.join(
    process.cwd(),
    "src",
    "app",
    "(crm)",
    "invoices",
    "archive",
    "page.tsx",
  );
  return readFileSync(filePath, "utf8");
}

test("invoice archive links enthalten keine fehlerhaften URL-Muster", () => {
  const source = readArchivePageSource();

  expect(source).not.toContain("/invoicesinvoiceId=");
  expect(source).not.toContain("/previewinvoiceNumber=");
  expect(source).not.toContain("/pdfinvoiceNumber=");
  expect(source).not.toContain("/pdfdownload=");
});

test("invoice archive links verwenden korrekte Trenner für Pfad und Query", () => {
  const source = readArchivePageSource();

  expect(source).toContain("`/invoices/${invoice.id}/preview?${suffix}`");
  expect(source).toContain("`/api/invoices/${invoice.id}/pdf?${params.toString()}`");
  expect(source).toContain("`/invoices?invoiceId=${invoice.id}`");
});
