-- Reservas de mantenimiento: eventId opcional + tipo + título. Vía Management API.
ALTER TABLE "SpaceReservation" ALTER COLUMN "eventId" DROP NOT NULL;
ALTER TABLE "SpaceReservation" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'EVENTO';
ALTER TABLE "SpaceReservation" ADD COLUMN IF NOT EXISTS "title" TEXT;
