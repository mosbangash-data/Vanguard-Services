-- Add the missing required timestamp declared by VehicleMedia.updatedAt.
ALTER TABLE "VehicleMedia"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Prisma's @updatedAt manages future updates; the database only needs the initial value.
ALTER TABLE "VehicleMedia"
ALTER COLUMN "updatedAt" DROP DEFAULT;
