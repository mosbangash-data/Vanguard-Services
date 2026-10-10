CREATE TYPE "ParcelPaymentTiming" AS ENUM ('AT_DEPOSIT', 'AT_PICKUP');

ALTER TABLE "Parcel"
ADD COLUMN "paymentTiming" "ParcelPaymentTiming" NOT NULL DEFAULT 'AT_DEPOSIT';
