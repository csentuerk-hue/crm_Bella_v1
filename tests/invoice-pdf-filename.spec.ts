import { expect, test } from "@playwright/test";

import {
  buildExpectedInvoicePdfFileName,
  deriveInvoicePdfStatus,
} from "@/lib/invoice-pdf";

test("buildExpectedInvoicePdfFileName erzeugt stabilen, sanitisierten Dateinamen", () => {
  const fileName = buildExpectedInvoicePdfFileName({
    invoiceNumber: "BBS-2026-0063",
    recipientName: "Studio Event ÜG",
    issueDate: "2026-05-06T10:00:00.000Z",
  });

  expect(fileName).toBe("BBS-2026-0063_Studio-Event-UeG_2026-05-06.pdf");
});

test("buildExpectedInvoicePdfFileName nutzt Fallback ohne Rechnungsnummer", () => {
  const fileName = buildExpectedInvoicePdfFileName({
    recipientName: "Müller & Söhne GmbH",
    serviceDate: "2026-01-09T00:00:00.000Z",
  });

  expect(fileName).toBe("BBS-Rechnung_Mueller-Soehne-GmbH_2026-01-09.pdf");
});

test("deriveInvoicePdfStatus leitet den Unterlagenstatus korrekt ab", () => {
  expect(deriveInvoicePdfStatus({})).toBe("MISSING");
  expect(
    deriveInvoicePdfStatus({ pdfDownloadedAt: "2026-05-07T12:00:00.000Z" }),
  ).toBe("DOWNLOADED");
  expect(
    deriveInvoicePdfStatus({
      pdfDownloadedAt: "2026-05-07T12:00:00.000Z",
      pdfMarkedSavedAt: "2026-05-07T12:30:00.000Z",
    }),
  ).toBe("SAVED");
});
