-- BEO (Banquet Event Order) + log de actividad. Aplicado vía Management API.
CREATE TABLE IF NOT EXISTS "Beo" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "number"       INTEGER NOT NULL,
  "eventId"      TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'BORRADOR',
  "responsable"  TEXT,
  "publicToken"  TEXT NOT NULL,
  "eventName"    TEXT,
  "clientName"   TEXT,
  "spaceName"    TEXT,
  "eventDate"    TIMESTAMP(3),
  "startTime"    TEXT,
  "pax"          INTEGER,
  "schedule"     JSONB,
  "menu"         JSONB,
  "departments"  JSONB,
  "generalNotes" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Beo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Beo_number_key" ON "Beo" ("number");
CREATE UNIQUE INDEX IF NOT EXISTS "Beo_eventId_key" ON "Beo" ("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "Beo_publicToken_key" ON "Beo" ("publicToken");

ALTER TABLE "Beo" DROP CONSTRAINT IF EXISTS "Beo_eventId_fkey";
ALTER TABLE "Beo" ADD CONSTRAINT "Beo_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Beo" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "BeoLog" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "beoId"     TEXT NOT NULL,
  "userId"    TEXT,
  "userName"  TEXT,
  "action"    TEXT NOT NULL,
  "detail"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BeoLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BeoLog_beoId_idx" ON "BeoLog" ("beoId");

ALTER TABLE "BeoLog" ENABLE ROW LEVEL SECURITY;
