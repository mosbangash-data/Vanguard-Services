-- Associate local Coach users with one agency without changing existing users.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agencyId" TEXT;

CREATE INDEX IF NOT EXISTS "User_agencyId_idx" ON "User"("agencyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_agencyId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;