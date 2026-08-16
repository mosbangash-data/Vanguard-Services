/*
  Warnings:

  - You are about to drop the column `contactPerson` on the `Agency` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Agency` table. All the data in the column will be lost.
  - You are about to drop the column `agencyId` on the `Bus` table. All the data in the column will be lost.
  - You are about to drop the column `agencyId` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `agencyId` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the `Destination` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `departmentId` on table `Agency` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `departmentId` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Driver` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Agency" DROP CONSTRAINT "Agency_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "Bus" DROP CONSTRAINT "Bus_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "Destination" DROP CONSTRAINT "Destination_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "Driver" DROP CONSTRAINT "Driver_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_agencyId_fkey";

-- AlterTable
ALTER TABLE "Agency" DROP COLUMN "contactPerson",
DROP COLUMN "email",
ALTER COLUMN "departmentId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Bus" DROP COLUMN "agencyId";

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "agencyId",
DROP COLUMN "fullName",
ADD COLUMN     "departmentId" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Schedule" DROP COLUMN "agencyId";

-- DropTable
DROP TABLE "Destination";

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
