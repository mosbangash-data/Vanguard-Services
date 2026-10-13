CREATE TYPE "AgencyStaffPayFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "AgencyStaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE');

CREATE TABLE "AgencyStaffMember" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "hireDate" DATE NOT NULL,
    "compensation" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "payFrequency" "AgencyStaffPayFrequency" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyStaffMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyStaffAttendance" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "status" "AgencyStaffAttendanceStatus" NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyStaffAttendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgencyStaffMember_agencyId_isActive_idx" ON "AgencyStaffMember"("agencyId", "isActive");
CREATE INDEX "AgencyStaffMember_agencyId_fullName_idx" ON "AgencyStaffMember"("agencyId", "fullName");
CREATE UNIQUE INDEX "AgencyStaffAttendance_staffMemberId_attendanceDate_key" ON "AgencyStaffAttendance"("staffMemberId", "attendanceDate");
CREATE INDEX "AgencyStaffAttendance_attendanceDate_status_idx" ON "AgencyStaffAttendance"("attendanceDate", "status");

ALTER TABLE "AgencyStaffMember" ADD CONSTRAINT "AgencyStaffMember_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgencyStaffMember" ADD CONSTRAINT "AgencyStaffMember_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgencyStaffMember" ADD CONSTRAINT "AgencyStaffMember_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgencyStaffAttendance" ADD CONSTRAINT "AgencyStaffAttendance_staffMemberId_fkey"
  FOREIGN KEY ("staffMemberId") REFERENCES "AgencyStaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgencyStaffAttendance" ADD CONSTRAINT "AgencyStaffAttendance_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgencyStaffAttendance" ADD CONSTRAINT "AgencyStaffAttendance_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
