-- Keep cancelled reservations as durable history, while making their seats reusable.
ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "Reservation_tripId_seatNumber_key";
DROP INDEX IF EXISTS "Reservation_tripId_seatNumber_key";
CREATE INDEX IF NOT EXISTS "Reservation_tripId_seatNumber_idx" ON "Reservation"("tripId", "seatNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_active_trip_seat_key"
  ON "Reservation"("tripId", "seatNumber")
  WHERE "status" IN ('PENDING', 'CONFIRMED');

-- A reservation with payments, tickets, or cancellation records cannot be hard-deleted.
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_reservationId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_reservationId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationCancellation" DROP CONSTRAINT IF EXISTS "ReservationCancellation_reservationId_fkey";
ALTER TABLE "ReservationCancellation" ADD CONSTRAINT "ReservationCancellation_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "Reservation_tripId_fkey";
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
