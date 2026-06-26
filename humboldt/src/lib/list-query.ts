// Helpers compartidos para listados con filtros server-side (vía searchParams).
// Una sola fuente de verdad para parsear ?q / ?estado / ?desde / ?hasta / ?dir
// y convertirlos en filtros Prisma. Lo usan Cotizaciones, BEO y Clientes.

import { dateKeyToUtcDate } from "@/lib/dates";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;
export type SortDir = "asc" | "desc";

/** Formato de fecha de los <input type="date">: yyyy-MM-dd. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Lee un searchParam como string limpio ("" si no viene o es array). */
export function getParam(sp: SearchParamsRecord, key: string): string {
  const v = sp[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Dirección de orden desde ?dir, con fallback configurable (default "desc"). */
export function parseDir(sp: SearchParamsRecord, fallback: SortDir = "desc"): SortDir {
  const v = getParam(sp, "dir");
  return v === "asc" || v === "desc" ? v : fallback;
}

export interface DateRange {
  /** Valores crudos de la URL (yyyy-MM-dd), para repoblar los inputs. */
  desde: string;
  hasta: string;
  /** Límite inferior: medianoche UTC del día `desde` (null si no aplica). */
  gte: Date | null;
  /** Límite superior: fin del día `hasta` en UTC (null si no aplica). */
  lte: Date | null;
}

/**
 * Parsea ?desde / ?hasta (yyyy-MM-dd) a un rango con bordes en UTC.
 *
 * Importante: los bordes se construyen en UTC (no en hora local del server),
 * para respetar la convención canónica del repo (ver src/lib/dates.ts): las
 * fechas de día completo (Event.startDate, Beo.eventDate) se almacenan a
 * medianoche UTC. Así el filtro no se corre un día en servidores con zona
 * horaria negativa (p. ej. el hotel opera en Venezuela, UTC-4). Ignora valores
 * que no cumplan el formato yyyy-MM-dd.
 */
export function parseDateRange(sp: SearchParamsRecord): DateRange {
  const desde = getParam(sp, "desde");
  const hasta = getParam(sp, "hasta");
  return {
    desde,
    hasta,
    gte: ISO_DAY.test(desde) ? dateKeyToUtcDate(desde) : null,
    lte: ISO_DAY.test(hasta) ? new Date(`${hasta}T23:59:59.999Z`) : null,
  };
}

/**
 * Convierte un DateRange en el filtro Prisma para un campo DateTime.
 * Devuelve `undefined` si no hay rango activo (para no ensuciar el `where`).
 */
export function dateTimeFilter(range: DateRange): { gte?: Date; lte?: Date } | undefined {
  if (!range.gte && !range.lte) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (range.gte) filter.gte = range.gte;
  if (range.lte) filter.lte = range.lte;
  return filter;
}

/** ¿Hay algún filtro de rango activo? Útil para textos de "sin resultados". */
export function hasDateRange(range: DateRange): boolean {
  return Boolean(range.gte || range.lte);
}
