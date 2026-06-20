-- Tabla ReservationLog (log de actividad por reserva). Aplicada vía Management API.
CREATE TABLE IF NOT EXISTS "ReservationLog" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "reservationId" TEXT NOT NULL,
  "userId"        TEXT,
  "userName"      TEXT,
  "action"        TEXT NOT NULL,
  "detail"        TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReservationLog_reservationId_idx" ON "ReservationLog" ("reservationId");

ALTER TABLE "ReservationLog" ENABLE ROW LEVEL SECURITY;
