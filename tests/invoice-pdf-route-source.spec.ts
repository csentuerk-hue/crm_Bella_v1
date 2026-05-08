import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

function readPdfRouteSource() {
  return readFileSync(
    path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "invoices",
      "[id]",
      "pdf",
      "route.ts",
    ),
    "utf8",
  );
}

test("pdf route nutzt den Dateinamen-Helper und korrektes Content-Disposition", () => {
  const source = readPdfRouteSource();

  expect(source).toContain("buildExpectedInvoicePdfFileName");
  expect(source).toContain("const fileName = buildExpectedInvoicePdfFileName");
  expect(source).toContain("filename=\\\"${fileName}\\\"");
  expect(source).not.toContain("filename=\\\"${fileName}.pdf\\\"");
});
