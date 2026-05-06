-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('OPEN', 'PAID', 'PARTIALLY_PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceDocumentStatus" AS ENUM ('DRAFT', 'FINAL', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerNoteType" AS ENUM ('GENERAL', 'APPOINTMENT', 'INVOICE', 'CARE', 'WARNING');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "finalPriceCents" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "plannedPaymentMethod" "PaymentMethod",
ADD COLUMN     "plannedPriceCents" INTEGER,
ADD COLUMN     "roomLabel" TEXT,
ADD COLUMN     "serviceId" TEXT,
ADD COLUMN     "staffName" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "contraindications" TEXT,
ADD COLUMN     "customerNumber" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "mediaConsentAt" TIMESTAMP(3),
ADD COLUMN     "privacyConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privacyConsentAt" TIMESTAMP(3),
ADD COLUMN     "sensitivities" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "tags" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "documentStatus" "InvoiceDocumentStatus" NOT NULL DEFAULT 'FINAL',
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "pdfGeneratedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "serviceId" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "defaultPriceCents" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "noteType" "CustomerNoteType" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'OPEN',
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerNote_customerId_createdAt_idx" ON "CustomerNote"("customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Payment_invoiceId_createdAt_idx" ON "Payment"("invoiceId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerNumber_key" ON "Customer"("customerNumber");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
