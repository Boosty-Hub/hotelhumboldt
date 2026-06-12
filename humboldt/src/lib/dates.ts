// Utilidades de fecha de "día calendario" — sin hora.
//
// Convención canónica del sistema: las fechas de día completo (evento, reserva
// de salón, vencimiento) se almacenan a MEDIANOCHE UTC. Así el calendario, el
// cotizador y los chequeos de conflicto comparan el mismo instante, sin importar
// la zona horaria del servidor. Para mostrarlas se interpretan en UTC para que
// no se corran un día.

import { format } from "date-fns";
import { es } from "date-fns/locale";

/** 'yyyy-MM-dd' → Date a medianoche UTC (formato canónico en BD). */
export function dateKeyToUtcDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Date → clave de día 'yyyy-MM-dd' usando el día UTC. */
export function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Normaliza cualquier Date a medianoche UTC de su día UTC. */
export function floorUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Rango [gte, lt) que cubre todo el día UTC de la fecha — para chequeos de solape. */
export function utcDayRange(d: Date): { gte: Date; lt: Date } {
  const gte = floorUtcDay(d);
  const lt = new Date(gte.getTime() + 86_400_000);
  return { gte, lt };
}

/**
 * Formatea una fecha de día completo (almacenada en UTC) interpretándola en UTC,
 * para que no se corra un día al renderizar en servidores con zona negativa.
 */
export function formatDayEs(d: Date, fmt = "EEEE d 'de' MMMM 'de' yyyy"): string {
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return format(local, fmt, { locale: es });
}

/**
 * Convierte un Date de un selector de calendario (medianoche LOCAL del día que
 * el usuario eligió) a medianoche UTC de ESE día — a prueba de zona horaria.
 */
export function pickerDateToUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Clave 'yyyy-MM-dd' del día UTC, para precargar inputs <input type="date">. */
export function toInputDateKey(d: Date): string {
  return toDayKey(d);
}
