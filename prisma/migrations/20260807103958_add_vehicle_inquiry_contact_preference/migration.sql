/*
  Warnings:

  - The values [WAITING_FOR_CLIENT] on the enum `CustomerRequestStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CustomerRequestStatus_new" AS ENUM ('NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED');
ALTER TABLE "public"."CustomerRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."VehicleInquiry" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CustomerRequest" ALTER COLUMN "status" TYPE "CustomerRequestStatus_new" USING ("status"::text::"CustomerRequestStatus_new");
ALTER TABLE "VehicleInquiry" ALTER COLUMN "status" TYPE "CustomerRequestStatus_new" USING ("status"::text::"CustomerRequestStatus_new");
ALTER TYPE "CustomerRequestStatus" RENAME TO "CustomerRequestStatus_old";
ALTER TYPE "CustomerRequestStatus_new" RENAME TO "CustomerRequestStatus";
DROP TYPE "public"."CustomerRequestStatus_old";
ALTER TABLE "CustomerRequest" ALTER COLUMN "status" SET DEFAULT 'NEW';
ALTER TABLE "VehicleInquiry" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- DropForeignKey
ALTER TABLE "VehicleInquiry" DROP CONSTRAINT "VehicleInquiry_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleReservation" DROP CONSTRAINT "VehicleReservation_vehicleId_fkey";

-- AlterTable
ALTER TABLE "VehicleInquiry" ADD COLUMN     "contactPreference" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "internalNotes" TEXT;

-- CreateIndex
CREATE INDEX "Payment_vehicleReservationId_idx" ON "Payment"("vehicleReservationId");

-- CreateIndex
CREATE INDEX "VehicleInquiry_vehicleId_idx" ON "VehicleInquiry"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleInquiry_assignedToUserId_idx" ON "VehicleInquiry"("assignedToUserId");

-- CreateIndex
CREATE INDEX "VehicleInquiry_createdByUserId_idx" ON "VehicleInquiry"("createdByUserId");

-- CreateIndex
CREATE INDEX "VehicleInquiry_status_idx" ON "VehicleInquiry"("status");

-- CreateIndex
CREATE INDEX "VehicleMedia_vehicleId_idx" ON "VehicleMedia"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleReservation_vehicleId_idx" ON "VehicleReservation"("vehicleId");

-- AddForeignKey
ALTER TABLE "VehicleInquiry" ADD CONSTRAINT "VehicleInquiry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInquiry" ADD CONSTRAINT "VehicleInquiry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
