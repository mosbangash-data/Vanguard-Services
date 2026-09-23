-- Add explicit agency ownership to Coach schedules and reservations.
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;

CREATE INDEX IF NOT EXISTS "Schedule_agencyId_idx" ON "Schedule"("agencyId");
CREATE INDEX IF NOT EXISTS "Reservation_agencyId_idx" ON "Reservation"("agencyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Schedule_agencyId_fkey') THEN
    ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_agencyId_fkey') THEN
    ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;