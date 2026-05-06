-- Allow invoices without appointment and bind invoices directly to a customer.
ALTER TABLE "Invoice"
  ADD COLUMN "customerId" TEXT,
  ALTER COLUMN "appointmentId" DROP NOT NULL;

-- Backfill existing invoices from their appointment relation.
UPDATE "Invoice" AS i
SET "customerId" = a."customerId"
FROM "Appointment" AS a
WHERE i."appointmentId" = a."id";

-- Keep integrity strict: every invoice must have a customer.
ALTER TABLE "Invoice"
  ALTER COLUMN "customerId" SET NOT NULL;

CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_customerId_fkey"
  FOREIGN KEY ("customerId")
  REFERENCES "Customer"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

