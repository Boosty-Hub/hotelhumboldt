-- Métodos de pago que recibe cada banco (BankAccount.methods).
-- Aplicar en cada entorno (este proyecto aplica cambios de schema por SQL directo
-- vía scripts/supabase-sql.mjs, no por prisma migrate):
--   node --env-file=.env scripts/supabase-sql.mjs prisma/add-bankaccount-methods.sql

ALTER TABLE "BankAccount"
  ADD COLUMN IF NOT EXISTS "methods" text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill coherente con la moneda del banco (solo cuentas sin métodos aún).
-- BS:  BOLIVARES, TARJETA_DEBITO, TARJETA_CREDITO, OBSEQUIO
-- USD: ZELLE, EFECTIVO_DIVISAS, TRANSFERENCIA, OBSEQUIO
UPDATE "BankAccount"
  SET "methods" = ARRAY['BOLIVARES','TARJETA_DEBITO','TARJETA_CREDITO','OBSEQUIO']::text[]
  WHERE currency = 'BS' AND cardinality("methods") = 0;

UPDATE "BankAccount"
  SET "methods" = ARRAY['ZELLE','EFECTIVO_DIVISAS','TRANSFERENCIA','OBSEQUIO']::text[]
  WHERE currency = 'USD' AND cardinality("methods") = 0;
