import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

function readArchivePageSource() {
  return readFileSync(
    path.join(
      process.cwd(),
      "src",
      "app",
      "(crm)",
      "invoices",
      "archive",
      "page.tsx",
    ),
    "utf8",
  );
}

test("invoice archive enthält PDF-Unterlagenstatus und Aktionen", () => {
  const source = readArchivePageSource();

  expect(source).toContain("PDF-Ablage / Unterlagenstatus");
  expect(source).toContain("PDF fehlt");
  expect(source).toContain("PDF heruntergeladen");
  expect(source).toContain("PDF gespeichert");
  expect(source).toContain("PDF herunterladen");
  expect(source).toContain("Als gespeichert markieren");
  expect(source).toContain("Status zurücksetzen");
  expect(source).toContain("/pdf-status");
});
