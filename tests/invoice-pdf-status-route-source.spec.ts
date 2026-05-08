import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

function readPdfStatusRouteSource() {
  return readFileSync(
    path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "invoices",
      "[id]",
      "pdf-status",
      "route.ts",
    ),
    "utf8",
  );
}

test("pdf-status route unterstützt die erwarteten Aktionen", () => {
  const source = readPdfStatusRouteSource();

  expect(source).toContain('"MARK_DOWNLOADED"');
  expect(source).toContain('"MARK_SAVED"');
  expect(source).toContain('"RESET"');
});

test("pdf-status route setzt/cleart die relevanten PDF-Statusfelder", () => {
  const source = readPdfStatusRouteSource();

  expect(source).toContain("pdfDownloadedAt");
  expect(source).toContain("pdfMarkedSavedAt");
  expect(source).toContain("pdfFileName");
  expect(source).toContain("pdfDownloadedAt: null");
  expect(source).toContain("pdfMarkedSavedAt: null");
});
