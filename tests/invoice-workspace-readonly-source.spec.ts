import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

function readInvoiceWorkspaceSource() {
  return readFileSync(
    path.join(
      process.cwd(),
      "src",
      "app",
      "(crm)",
      "invoices",
      "page.tsx",
    ),
    "utf8",
  );
}

test("finalisierte Rechnung wird im Workspace als Lesemodus markiert", () => {
  const source = readInvoiceWorkspaceSource();

  expect(source).toContain("const isSelectedInvoiceFinalized");
  expect(source).toContain(
    "Diese Rechnung ist finalisiert und kann nicht mehr bearbeitet werden.",
  );
  expect(source).toContain("<fieldset disabled={isSelectedInvoiceFinalized}");
  expect(source).toContain(
    "Finalisierte Rechnung aus dem Archiv ist im Lesemodus geöffnet.",
  );
  expect(source).toContain("Finalisierte Rechnung ist im Lesemodus geöffnet.");
});

test("draft-actions bleiben im Source erhalten und werden nur im Entwurfsmodus gerendert", () => {
  const source = readInvoiceWorkspaceSource();

  expect(source).toContain("Entwurf speichern");
  expect(source).toContain("Finalisieren");
  expect(source).toContain("{!isSelectedInvoiceFinalized ? (");
  expect(source).not.toContain(
    "Finalisierte Rechnung bleibt editierbar; PDF wird bei Änderungen neu erzeugt.",
  );
});

