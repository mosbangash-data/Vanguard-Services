-- Additive AutoSales sales metadata. Existing vehicles remain priced in USD.
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
