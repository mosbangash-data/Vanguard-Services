ALTER TABLE "Agency"
ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Africa/Kinshasa';

CREATE TYPE "CashClosureStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "CashClosureEntrySource" AS ENUM ('RESERVATION', 'PARCEL');
CREATE TYPE "CashClosureCorrectionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "CashClosure" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "timeZone" TEXT NOT NULL,
  "status" "CashClosureStatus" NOT NULL DEFAULT 'DRAFT',
  "theoreticalUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "theoreticalCdf" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "declaredUsd" DECIMAL(14,2),
  "declaredCdf" DECIMAL(14,2),
  "justification" TEXT,
  "createdById" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "submittedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectedById" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashClosure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashClosureEntry" (
  "id" TEXT NOT NULL,
  "closureId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "source" "CashClosureEntrySource" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "collectedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashClosureEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashClosureEvent" (
  "id" TEXT NOT NULL,
  "closureId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashClosureEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashClosureCorrection" (
  "id" TEXT NOT NULL,
  "closureId" TEXT NOT NULL,
  "amountUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "amountCdf" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "status" "CashClosureCorrectionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "createdById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashClosureCorrection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashClosure_agencyId_businessDate_key" ON "CashClosure"("agencyId", "businessDate");
CREATE INDEX "CashClosure_agencyId_status_businessDate_idx" ON "CashClosure"("agencyId", "status", "businessDate");
CREATE UNIQUE INDEX "CashClosureEntry_paymentId_key" ON "CashClosureEntry"("paymentId");
CREATE INDEX "CashClosureEntry_closureId_currency_idx" ON "CashClosureEntry"("closureId", "currency");
CREATE INDEX "CashClosureEvent_closureId_createdAt_idx" ON "CashClosureEvent"("closureId", "createdAt");
CREATE INDEX "CashClosureCorrection_closureId_status_idx" ON "CashClosureCorrection"("closureId", "status");

ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashClosureEntry" ADD CONSTRAINT "CashClosureEntry_closureId_fkey"
  FOREIGN KEY ("closureId") REFERENCES "CashClosure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashClosureEntry" ADD CONSTRAINT "CashClosureEntry_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashClosureEvent" ADD CONSTRAINT "CashClosureEvent_closureId_fkey"
  FOREIGN KEY ("closureId") REFERENCES "CashClosure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashClosureCorrection" ADD CONSTRAINT "CashClosureCorrection_closureId_fkey"
  FOREIGN KEY ("closureId") REFERENCES "CashClosure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "Permission" ("id", "name", "description", "createdAt", "updatedAt")
VALUES ('approve-daily-cash-closure', 'APPROVE_DAILY_CASH_CLOSURE', 'Approve or reject daily agency cash closures', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'cash-closure-' || role."id", role."id", permission."id"
FROM "Role" role
JOIN "Permission" permission ON permission."name" = 'APPROVE_DAILY_CASH_CLOSURE'
WHERE role."name" IN ('SUPER_ADMIN', 'SERVICE_ADMIN', 'MANAGER')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
