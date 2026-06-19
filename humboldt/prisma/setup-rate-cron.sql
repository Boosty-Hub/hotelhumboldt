-- Refresh automático de la tasa de cambio en Supabase: extensiones + función + cron cada 2h.
-- Fuentes: ve.dolarapi.com (oficial) con fallback a api.exchangedyn.com. Escribe en "ExchangeRate".

-- 1) Extensiones
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

-- 2) Default de id para inserts que NO vienen de Prisma (el cron). Prisma sigue
--    generando su propio cuid, así que solo aplica cuando se omite el id.
alter table "ExchangeRate" alter column "id" set default gen_random_uuid()::text;

-- 3) Función: trae la tasa oficial (2 fuentes con fallback) y la guarda si cambió.
create or replace function public.refresh_exchange_rate()
returns text
language plpgsql
security definer
set search_path = public, extensions
set statement_timeout = '15000'
as $fn$
declare
  v_json jsonb;
  v_rate numeric;
  v_last numeric;
begin
  -- Fuente 1: dolarapi oficial (promedio / precio)
  begin
    select (http_get('https://ve.dolarapi.com/v1/dolares/oficial')).content::jsonb into v_json;
    v_rate := coalesce(nullif(v_json->>'promedio', '')::numeric, nullif(v_json->>'precio', '')::numeric);
  exception when others then
    v_rate := null;
  end;

  -- Fuente 2 (fallback): exchangedyn -> sources.BCV.quote
  if v_rate is null or v_rate <= 0 then
    begin
      select (http_get('https://api.exchangedyn.com/markets/quotes/usdves/bcv')).content::jsonb into v_json;
      v_rate := nullif(v_json #>> '{sources,BCV,quote}', '')::numeric;
    exception when others then
      v_rate := null;
    end;
  end if;

  if v_rate is null or v_rate <= 0 then
    return 'sin-tasa: ninguna fuente respondió';
  end if;

  v_rate := round(v_rate, 2);

  -- Evitar filas duplicadas: solo insertar si cambió respecto a la última.
  select rate into v_last from "ExchangeRate" order by date desc limit 1;
  if v_last is distinct from v_rate then
    insert into "ExchangeRate" (date, rate, source) values (now(), v_rate, 'BCV');
    return 'insertada: ' || v_rate;
  end if;
  return 'sin-cambio: ' || v_rate;
end;
$fn$;

-- 4) Agenda cada 2 horas (minuto 0). Si ya existe el job, lo actualiza por nombre.
select cron.schedule('refresh-exchange-rate', '0 */2 * * *', $cron$ select public.refresh_exchange_rate(); $cron$);
