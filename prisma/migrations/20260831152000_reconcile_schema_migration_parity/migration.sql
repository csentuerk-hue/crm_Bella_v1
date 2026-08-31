-- Reconcile committed migration history with the current Prisma schema.
-- This migration is intentionally idempotent where production may already
-- contain schema changes that were previously applied via `prisma db push`.
-- It does not delete invoice/customer data.

-- Invoice lifecycle enum may already exist on databases previously synced via db push.
DO $$
BEGIN
  CREATE TYPE "InvoiceLifecycleStatus" AS ENUM ('ENTWURF', 'FINALISIERT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "InvoiceLifecycleStatus" ADD VALUE IF NOT EXISTS 'ENTWURF';
ALTER TYPE "InvoiceLifecycleStatus" ADD VALUE IF NOT EXISTS 'FINALISIERT';

-- Draft invoices need nullable sequence/invoice number until finalization.
ALTER TABLE "Invoice"
  ALTER COLUMN "sequence" DROP NOT NULL,
  ALTER COLUMN "invoiceNumber" DROP NOT NULL;

-- Current application/schema default is draft, not final.
ALTER TABLE "Invoice"
  ALTER COLUMN "documentStatus" SET DEFAULT 'DRAFT';

-- Add lifecycle state without overwriting an already existing production column.
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "InvoiceLifecycleStatus";

-- If this column is newly added to a database that already contains invoices,
-- derive the lifecycle from the document state instead of marking final invoices as drafts.
UPDATE "Invoice"
SET "lifecycleStatus" = CASE
  WHEN "documentStatus" IN ('FINAL', 'SENT', 'CANCELLED')
    THEN 'FINALISIERT'::"InvoiceLifecycleStatus"
  ELSE 'ENTWURF'::"InvoiceLifecycleStatus"
END
WHERE "lifecycleStatus" IS NULL;

ALTER TABLE "Invoice"
  ALTER COLUMN "lifecycleStatus" SET DEFAULT 'ENTWURF',
  ALTER COLUMN "lifecycleStatus" SET NOT NULL;

-- Tracks the last content edit independently from Prisma's updatedAt field.
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Keep DB compatibility with legacy invoices while the app/API requires a customer.
-- This matches schema.prisma: nullable customerId and ON DELETE SET NULL.
ALTER TABLE "Invoice"
  DROP CONSTRAINT IF EXISTS "Invoice_customerId_fkey";

ALTER TABLE "Invoice"
  ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_customerId_fkey"
  FOREIGN KEY ("customerId")
  REFERENCES "Customer"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Align database defaults with schema.prisma.
ALTER TABLE "Invoice"
  ALTER COLUMN "recipientLabel" SET DEFAULT 'Rechnung an:',
  ALTER COLUMN "transferPaymentTitle" SET DEFAULT 'Zahlungsart: Überweisung',
  ALTER COLUMN "transferPaymentNotice" SET DEFAULT 'Zahlungsziel: innerhalb der nächsten {X} Werktage.',
  ALTER COLUMN "cashPaymentTitle" SET DEFAULT 'Zahlungsart: Barzahlung',
  ALTER COLUMN "cashPaymentNote" SET DEFAULT 'Der Betrag wurde in bar beglichen.',
  ALTER COLUMN "cardPaymentTitle" SET DEFAULT 'Zahlungsart: Kartenzahlung',
  ALTER COLUMN "cardPaymentNote" SET DEFAULT 'Der Betrag wurde per Kartenzahlung beglichen.',
  ALTER COLUMN "legalSmallBusinessNote" SET DEFAULT 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
  ALTER COLUMN "closingText" SET DEFAULT 'Vielen Dank für Ihren Besuch!';

ALTER TABLE "InvoiceSettings"
  ALTER COLUMN "recipientLabel" SET DEFAULT 'Rechnung an:',
  ALTER COLUMN "transferPaymentTitle" SET DEFAULT 'Zahlungsart: Überweisung',
  ALTER COLUMN "transferPaymentNotice" SET DEFAULT 'Zahlungsziel: innerhalb der nächsten {X} Werktage.',
  ALTER COLUMN "cashPaymentTitle" SET DEFAULT 'Zahlungsart: Barzahlung',
  ALTER COLUMN "cashPaymentNote" SET DEFAULT 'Der Betrag wurde in bar beglichen.',
  ALTER COLUMN "cardPaymentTitle" SET DEFAULT 'Zahlungsart: Kartenzahlung',
  ALTER COLUMN "cardPaymentNote" SET DEFAULT 'Der Betrag wurde per Kartenzahlung beglichen.',
  ALTER COLUMN "legalSmallBusinessNote" SET DEFAULT 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
  ALTER COLUMN "closingText" SET DEFAULT 'Vielen Dank für Ihren Besuch!';
