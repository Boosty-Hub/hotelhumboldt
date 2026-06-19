// Tasa de cambio BCV — consulta automática con override manual.
// Fuente primaria: API pública pydolarve (espejo del BCV).
// Si falla, se usa la última tasa guardada en la base de datos.

import { prisma } from "./prisma";
import { round2 } from "./money";

// Fuentes de la tasa oficial, con fallback. Mismas que usa el cron de Supabase
// (refresh_exchange_rate): dolarapi (promedio/precio) y exchangedyn (sources.BCV.quote).
const RATE_APIS = [
  "https://ve.dolarapi.com/v1/dolares/oficial",
  "https://api.exchangedyn.com/markets/quotes/usdves/bcv",
];

interface BcvResult {
  rate: number;
  date: Date;
  source: "BCV" | "MANUAL" | "CACHE";
}

/**
 * Consulta la tasa oficial (Bs/USD) probando las fuentes en orden con fallback.
 * Usada por getCurrentRate y por el refresco manual del modal de tasa.
 */
export async function fetchBcvRate(opts?: { force?: boolean }): Promise<number | null> {
  for (const url of RATE_APIS) {
    try {
      const res = await fetch(
        url,
        opts?.force
          ? { cache: "no-store", headers: { Accept: "application/json" } }
          : { next: { revalidate: 3600 }, headers: { Accept: "application/json" } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      // dolarapi -> promedio/precio | exchangedyn -> sources.BCV.quote
      const raw = data?.promedio ?? data?.precio ?? data?.sources?.BCV?.quote;
      const price = typeof raw === "number" ? raw : parseFloat(String(raw));
      if (price && !Number.isNaN(price) && price > 0) return round2(price);
    } catch {
      // probar la siguiente fuente
    }
  }
  return null;
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
