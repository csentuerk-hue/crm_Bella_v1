-- AlterTable
ALTER TABLE "Customer"
ADD COLUMN "birthday" TIMESTAMP(3),
ADD COLUMN "preferences" TEXT,
ADD COLUMN "allergies" TEXT,
ADD COLUMN "mediaConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "photoUrl" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'NEU';

-- CreateTable
CREATE TABLE "TreatmentEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "treatment" TEXT NOT NULL,
    "style" TEXT,
    "technique" TEXT,
    "length" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreatmentEntry_customerId_performedAt_idx" ON "TreatmentEntry"("customerId", "performedAt" DESC);

-- AddForeignKey
ALTER TABLE "TreatmentEntry" ADD CONSTRAINT "TreatmentEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
