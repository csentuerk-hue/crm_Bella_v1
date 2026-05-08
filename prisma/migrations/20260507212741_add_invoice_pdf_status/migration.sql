ALTER TABLE "Invoice" ADD COLUMN "pdfDownloadedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "pdfMarkedSavedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "pdfFileName" TEXT;