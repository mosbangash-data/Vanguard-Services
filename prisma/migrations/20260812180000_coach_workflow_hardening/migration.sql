-- Keep the existing role hierarchy while adding the operational Coach manager.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'MANAGER';

-- One reservation can yield exactly one electronic ticket. This makes ticket
-- generation idempotent even if payment validation requests race each other.
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_reservationId_key" ON "Ticket"("reservationId");
