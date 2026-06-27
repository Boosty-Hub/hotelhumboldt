// Tasa de cambio BCV — consulta automática con override manual.
// Fuente primaria: API pública pydolarve (espejo del BCV).
// Si falla, se usa la última tasa guardada en la base de datos.

import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { round2 } from "./money";

/** Tag de caché de la tasa de cambio. Las server actions que registran una tasa
 *  invalidan con updateTag(RATE_TAG) (ver configuracion/actions.ts). */
export const RATE_TAG = "exchange-rate";

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

// Forma cacheable: la fecha viaja como epoch ms (Number) para no depender de la
// (in)consistencia de serialización de Date a través de la caché de Next.
type RateLite = { rate: number; dateMs: number } | null;

/**
 * Lectura cacheada de la última tasa OFICIAL conocida. Read-only: NO consulta
 * APIs externas ni escribe en la DB durante el render. El refresco diario lo
 * hace el cron de Supabase (refresh_exchange_rate, cada 2h) y el botón manual
 * del modal de tasa. Se invalida por tag al guardar una tasa manual.
 */
const readOfficialRate = unstable_cache(
  async (): Promise<RateLite> => {
    const last = await prisma.exchangeRate.findFirst({
      where: { kind: "OFICIAL" },
      orderBy: { date: "desc" },
      select: { rate: true, date: true },
    });
    return last ? { rate: last.rate, dateMs: last.date.getTime() } : null;
  },
  ["official-rate"],
  { tags: [RATE_TAG], revalidate: 1800 }
);

const readParallelRate = unstable_cache(
  async (): Promise<RateLite> => {
    const last = await prisma.exchangeRate.findFirst({
      where: { kind: "PARALELA" },
      orderBy: { date: "desc" },
      select: { rate: true, date: true },
    });
    return last ? { rate: last.rate, dateMs: last.date.getTime() } : null;
  },
  ["parallel-rate"],
  { tags: [RATE_TAG], revalidate: 1800 }
);

/** Tasa BCV (OFICIAL) del día. Lectura cacheada de la última tasa conocida. */
export async function getCurrentRate(): Promise<BcvResult | null> {
  const r = await readOfficialRate();
  if (!r) return null;
  return { rate: r.rate, date: new Date(r.dateMs), source: "CACHE" };
}

/** Última tasa PARALELA registrada manualmente (no se consulta a ninguna API). */
export async function getParallelRate(): Promise<BcvResult | null> {
  const r = await readParallelRate();
  if (!r) return null;
  return { rate: r.rate, date: new Date(r.dateMs), source: "MANUAL" };
}

/** Registra una tasa manual. kind: OFICIAL (override BCV) | PARALELA. */
export async function saveManualRate(
  rate: number,
  kind: "OFICIAL" | "PARALELA" = "OFICIAL"
): Promise<void> {
  await prisma.exchangeRate.create({
    data: { date: new Date(), rate: round2(rate), source: "MANUAL", kind },
  });
  // La invalidación del tag (updateTag) la hace la server action que llama aquí.
}
