import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { buildInvoiceLayoutModel } from "@/lib/invoice-layout";
import type { InvoiceDTO } from "@/types/crm";

function createInvoiceForDiscountCheck(totalCents: number): InvoiceDTO {
  return {
    id: "inv-discount-check",
    sequence: null,
    invoiceNumber: "BBS-2026-0001",
    customerId: "cust-1",
    customerInitials: "MM",
    lifecycleStatus: "ENTWURF",
    invoiceKind: "KLEINBETRAGSRECHNUNG",
    issueDate: "2026-05-08T00:00:00.000Z",
    serviceDate: "2026-05-08T00:00:00.000Z",
    customerNumber: null,
    amountCents: totalCents,
    subtotalCents: 10000,
    totalCents,
    currency: "EUR",
    paymentMethod: "BANK_TRANSFER",
    paymentStatus: "OPEN",
    paymentDate: null,
    dueDate: null,
    paymentDeadlineBusinessDays: 10,
    smallBusinessEnabled: true,
    documentStatus: "DRAFT",
    status: "OFFEN",
    pdfPath: null,
    pdfGeneratedAt: null,
    pdfDownloadedAt: null,
    pdfMarkedSavedAt: null,
    pdfFileName: null,
    appointmentId: null,
    appointmentService: null,
    appointmentDate: null,
    customerName: "Max Mustermann",
    recipientLabel: "Rechnung an:",
    recipientName: "Max Mustermann",
    recipientAttention: "",
    recipientLine2: "",
    recipientStreet: "Musterstraße",
    recipientHouseNumber: "10",
    recipientZipCode: "48153",
    recipientCity: "Münster",
    recipientCountry: "Deutschland",
    recipientEmail: "",
    recipientPhone: "",
    recipientNotes: "",
    senderBusinessName: "Bella by Sobiella",
    senderOwnerName: "Nathaly Sobiella",
    senderStreet: "Westumer Landstr.",
    senderHouseNumber: "40a",
    senderZipCode: "48282",
    senderCity: "Emsdetten",
    senderPhone: "",
    senderEmail: "",
    senderTaxNumber: "",
    senderVatId: "",
    bankAccountHolder: "Nathaly Sobiella",
    bankIban: "DE55403619061012154300",
    bankBic: "GENODEM1IBB",
    bankName: "Volksbank",
    transferPaymentTitle: "Zahlungsart: Überweisung",
    transferPaymentNotice: "Zahlungsziel: innerhalb der nächsten 10 Werktage.",
    cashPaymentTitle: "Zahlungsart: Barzahlung",
    cashPaymentNote: "Der Betrag wurde in bar beglichen.",
    cardPaymentTitle: "Zahlungsart: Kartenzahlung",
    cardPaymentNote: "Der Betrag wurde per Kartenzahlung beglichen.",
    legalSmallBusinessNote: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
    closingText: "Vielen Dank!",
    additionalFooterNote: "",
    items: [
      {
        id: "item-1",
        serviceId: null,
        appointmentId: null,
        title: "Lash Refill",
        description: null,
        position: 1,
        service: "Lash Refill",
        quantity: 1,
        unitPriceCents: 10000,
        totalCents: 10000,
      },
    ],
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
  };
}

function readInvoiceDocumentSource() {
  return readFileSync(
    path.join(
      process.cwd(),
      "src",
      "components",
      "invoices",
      "invoice-document.tsx",
    ),
    "utf8",
  );
}

function readPdfSource() {
  return readFileSync(path.join(process.cwd(), "src", "lib", "pdf.ts"), "utf8");
}

test("layout blendet Rabatt aus, wenn kein echter Nachlass vorliegt", () => {
  const layout = buildInvoiceLayoutModel(createInvoiceForDiscountCheck(10000));

  expect(layout.showDiscount).toBeFalsy();
  expect(layout.discountCents).toBe(0);
});

test("layout zeigt Rabatt nur bei echtem Nachlass", () => {
  const layout = buildInvoiceLayoutModel(createInvoiceForDiscountCheck(9000));

  expect(layout.showDiscount).toBeTruthy();
  expect(layout.discountCents).toBe(1000);
  expect(layout.totalCents).toBe(9000);
});

test("preview und pdf rendern Rabatt nur bedingt", () => {
  const invoiceDocumentSource = readInvoiceDocumentSource();
  const pdfSource = readPdfSource();

  expect(invoiceDocumentSource).toContain("layout.showDiscount ? (");
  expect(pdfSource).toContain("if (layout.showDiscount)");
});
