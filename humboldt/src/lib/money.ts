// Utilidades de dinero — redondeo correcto a 2 decimales y formato.
// Los Excel actuales envían al cliente montos como 32.568,3534 — aquí se corrige.

/** Redondea a 2 decimales evitando errores de punto flotante (half-up). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Formatea un monto en USD: $32.568,35 (formato es-VE). */
export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(n));
}

/** Formatea un monto en bolívares: Bs. 2.050.918,96 */
export function fmtBs(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (
    "Bs. " +
    new Intl.NumberFormat("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(round2(n))
  );
}

/** Formatea un número genérico es-VE. */
export function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Formatea porcentaje: 16% / 10,5% */
export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const r = round2(n);
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(r) + "%";
}

/** Convierte Bs → USD con una tasa dada. */
export function bsToUsd(amountBs: number, rate: number): number {
  if (!rate) return 0;
  return round2(amountBs / rate);
}

/** Convierte USD → Bs con una tasa dada. */
export function usdToBs(amountUsd: number, rate: number): number {
  return round2(amountUsd * rate);
}
