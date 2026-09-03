-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('ONLINE', 'AGENCY');

-- AlterEnum
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'ARRIVED_AT_AGENCY';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'COLLECTED';
ALTER TYPE "ParcelStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "channel" "PaymentChannel" NOT NULL DEFAULT 'AGENCY';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerTransactionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerReference" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_channel_idx" ON "Payment"("channel");
CREATE INDEX IF NOT EXISTS "Payment_providerReference_idx" ON "Payment"("providerReference");
CREATE INDEX IF NOT EXISTS "Payment_parcelId_idx" ON "Payment"("parcelId");

-- AlterTable Parcel
ALTER TABLE "Parcel" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'STANDARD';
ALTER TABLE "Parcel" ADD COLUMN IF NOT EXISTS "senderEmail" TEXT;
ALTER TABLE "Parcel" ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT;
ALTER TABLE "Parcel" ADD COLUMN IF NOT EXISTS "originAgencyId" TEXT;
ALTER TABLE "Parcel" ADD COLUMN IF NOT EXISTS "destinationAgencyId" TEXT;
ALTER TABLE "Parcel" ADD COLUMN IF NOT EXISTS "declaredValue" DECIMAL(10,2);
ALTER TABLE "Parcel" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Parcel" ADD COLUMN IF NOT EXISTS "receivedByUserId" TEXT;
ALTER TABLE "Parcel" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Parcel_originAgencyId_idx" ON "Parcel"("originAgencyId");
CREATE INDEX IF NOT EXISTS "Parcel_destinationAgencyId_idx" ON "Parcel"("destinationAgencyId");

-- AddForeignKey to Parcel
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_originAgencyId_fkey" FOREIGN KEY ("originAgencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_destinationAgencyId_fkey" FOREIGN KEY ("destinationAgencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable ParcelPickup
CREATE TABLE IF NOT EXISTS "ParcelPickup" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "collectorName" TEXT NOT NULL,
    "collectorPhone" TEXT NOT NULL,
    "idType" TEXT NOT NULL,
    "idNumberEncrypted" TEXT NOT NULL,
    "idNumberMasked" TEXT NOT NULL,
    "pickedUpByUserId" TEXT NOT NULL,
    "pickedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelPickup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ParcelPickup_parcelId_key" ON "ParcelPickup"("parcelId");
CREATE INDEX IF NOT EXISTS "ParcelPickup_parcelId_idx" ON "ParcelPickup"("parcelId");
CREATE INDEX IF NOT EXISTS "ParcelPickup_pickedUpByUserId_idx" ON "ParcelPickup"("pickedUpByUserId");

-- AddForeignKey to ParcelPickup
ALTER TABLE "ParcelPickup" ADD CONSTRAINT "ParcelPickup_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParcelPickup" ADD CONSTRAINT "ParcelPickup_pickedUpByUserId_fkey" FOREIGN KEY ("pickedUpByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable ParcelStatusHistory
CREATE TABLE IF NOT EXISTS "ParcelStatusHistory" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "previousStatus" "ParcelStatus",
    "newStatus" "ParcelStatus" NOT NULL,
    "changedByUserId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "details" JSONB,

    CONSTRAINT "ParcelStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParcelStatusHistory_parcelId_idx" ON "ParcelStatusHistory"("parcelId");
CREATE INDEX IF NOT EXISTS "ParcelStatusHistory_changedAt_idx" ON "ParcelStatusHistory"("changedAt");

-- AddForeignKey to ParcelStatusHistory
ALTER TABLE "ParcelStatusHistory" ADD CONSTRAINT "ParcelStatusHistory_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParcelStatusHistory" ADD CONSTRAINT "ParcelStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
