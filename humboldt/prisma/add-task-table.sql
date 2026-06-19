-- Tabla Task (tareas programadas por oportunidad). Aplicada vía Management API.
CREATE TABLE IF NOT EXISTS "Task" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "opportunityId" TEXT NOT NULL,
  "assigneeId"    TEXT,
  "creatorId"     TEXT,
  "type"          TEXT NOT NULL DEFAULT 'VOLVER_CONTACTAR',
  "title"         TEXT NOT NULL,
  "notes"         TEXT,
  "dueAt"         TIMESTAMP(3) NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDIENTE',
  "recurrence"    TEXT NOT NULL DEFAULT 'NONE',
  "completedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Task_opportunityId_idx" ON "Task" ("opportunityId");
CREATE INDEX IF NOT EXISTS "Task_assigneeId_status_dueAt_idx" ON "Task" ("assigneeId", "status", "dueAt");

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_opportunityId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assigneeId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_creatorId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
