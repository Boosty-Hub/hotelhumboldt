// Tasa de cambio BCV — consulta automática con override manual.
// Fuente primaria: API pública pydolarve (espejo del BCV).
// Si falla, se usa la última tasa guardada en la base de datos.

import { prisma } from "./prisma";
import { round2 } from "./money";

const BCV_API = "https://pydolarve.org/api/v2/tipo-cambio";

interface BcvResult {
  rate: number;
  date: Date;
  source: "BCV" | "MANUAL" | "CACHE";
}

/**
 * Consulta cruda a la API del BCV. Devuelve la tasa (Bs/USD) o null si falla.
 * Fuente única del fetch — usada por getCurrentRate y por el refresco manual.
 */
export async function fetchBcvRate(opts?: { force?: boolean }): Promise<number | null> {
  try {
    const res = await fetch(
      BCV_API,
      opts?.force ? { cache: "no-store" } : { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = typeof data?.price === "number" ? data.price : parseFloat(data?.price);
    if (!price || Number.isNaN(price) || price <= 0) return null;
    return round2(price);
  } catch {
    return null;
  }
}

/** Obtiene la tasa BCV del día: API → cache local del día → última guardada. */
export async function getCurrentRate(): Promise<BcvResult | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ¿Ya tenemos la tasa de hoy?
  const cached = await prisma.exchangeRate.findFirst({
    where: { date: { gte: today } },
    orderBy: { date: "desc" },
  });
  if (cached) return { rate: cached.rate, date: cached.date, source: "CACHE" };

  // Consultar API BCV
  const price = await fetchBcvRate();
  if (price != null) {
    const saved = await prisma.exchangeRate.create({
      data: { date: new Date(), rate: price, source: "BCV" },
    });
    return { rate: saved.rate, date: saved.date, source: "BCV" };
  }

  // Última tasa conocida
  const last = await prisma.exchangeRate.findFirst({ orderBy: { date: "desc" } });
  if (last) return { rate: last.rate, date: last.date, source: "CACHE" };
  return null;
}

/** Registra una tasa manual (override). */
export async function saveManualRate(rate: number): Promise<void> {
  await prisma.exchangeRate.create({
    data: { date: new Date(), rate: round2(rate), source: "MANUAL" },
  });
}
