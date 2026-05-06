-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CARD');

-- DropIndex
DROP INDEX "public"."Appointment_customerId_idx";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "additionalFooterNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankAccountHolder" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankBic" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankIban" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cardPaymentNote" TEXT NOT NULL DEFAULT 'The amount was paid by card.',
ADD COLUMN     "cardPaymentTitle" TEXT NOT NULL DEFAULT 'Payment method: Card payment',
ADD COLUMN     "cashPaymentNote" TEXT NOT NULL DEFAULT 'The amount was paid in cash.',
ADD COLUMN     "cashPaymentTitle" TEXT NOT NULL DEFAULT 'Payment method: Cash',
ADD COLUMN     "closingText" TEXT NOT NULL DEFAULT 'Thank you for your visit!',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "customerNumber" TEXT,
ADD COLUMN     "legalSmallBusinessNote" TEXT NOT NULL DEFAULT 'According to § 19 UStG, no VAT is charged.',
ADD COLUMN     "paymentDeadlineBusinessDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
ADD COLUMN     "recipientCity" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "recipientHouseNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "recipientLabel" TEXT NOT NULL DEFAULT 'Invoice to:',
ADD COLUMN     "recipientName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "recipientStreet" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "recipientZipCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderBusinessName" TEXT NOT NULL DEFAULT 'Bella by Sobiella',
ADD COLUMN     "senderCity" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderHouseNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderOwnerName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderStreet" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderTaxNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderVatId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderZipCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "serviceDate" TIMESTAMP(3),
ADD COLUMN     "smallBusinessEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "subtotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transferPaymentNotice" TEXT NOT NULL DEFAULT 'Please transfer the amount within {X} business days.',
ADD COLUMN     "transferPaymentTitle" TEXT NOT NULL DEFAULT 'Payment method: Bank transfer';

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "service" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT 'Bella by Sobiella',
    "ownerName" TEXT NOT NULL DEFAULT '',
    "street" TEXT NOT NULL DEFAULT '',
    "houseNumber" TEXT NOT NULL DEFAULT '',
    "zipCode" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "taxNumber" TEXT NOT NULL DEFAULT '',
    "vatId" TEXT NOT NULL DEFAULT '',
    "bankAccountHolder" TEXT NOT NULL DEFAULT '',
    "bankIban" TEXT NOT NULL DEFAULT '',
    "bankBic" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "smallBusinessEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultPaymentDeadlineBusinessDays" INTEGER NOT NULL DEFAULT 7,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "defaultPaymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'BBS',
    "recipientLabel" TEXT NOT NULL DEFAULT 'Invoice to:',
    "transferPaymentTitle" TEXT NOT NULL DEFAULT 'Payment method: Bank transfer',
    "transferPaymentNotice" TEXT NOT NULL DEFAULT 'Please transfer the amount within {X} business days.',
    "cashPaymentTitle" TEXT NOT NULL DEFAULT 'Payment method: Cash',
    "cashPaymentNote" TEXT NOT NULL DEFAULT 'The amount was paid in cash.',
    "cardPaymentTitle" TEXT NOT NULL DEFAULT 'Payment method: Card payment',
    "cardPaymentNote" TEXT NOT NULL DEFAULT 'The amount was paid by card.',
    "legalSmallBusinessNote" TEXT NOT NULL DEFAULT 'According to § 19 UStG, no VAT is charged.',
    "closingText" TEXT NOT NULL DEFAULT 'Thank you for your visit!',
    "additionalFooterNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_position_idx" ON "InvoiceItem"("invoiceId", "position");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
