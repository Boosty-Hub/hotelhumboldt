import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { SETTING_KEYS } from "./constants";

/** Tag de caché de la tabla Setting. Invalidar con revalidateTag(SETTINGS_TAG)
 *  desde toda server action que escriba settings (ver configuracion/actions.ts). */
export const SETTINGS_TAG = "settings";

/** Forma mínima de una fila Setting (sin `updatedAt`, para que el resultado sea
 *  serializable y cacheable sin problemas de Date). */
type SettingLite = { key: string; value: string; enabled: boolean; category: string };

/**
 * Lee TODA la tabla Setting una sola vez y la cachea entre requests (la tabla es
 * diminuta y casi inmutable). Las tres funciones públicas derivan de aquí, así
 * que una navegación que necesite params + metas paga 0 round-trips tras la
 * primera lectura. Se invalida por tag al guardar configuración.
 */
const getAllSettings = unstable_cache(
  async (): Promise<SettingLite[]> =>
    prisma.setting.findMany({
      select: { key: true, value: true, enabled: true, category: true },
    }),
  ["all-settings"],
  { tags: [SETTINGS_TAG], revalidate: 3600 }
);

export interface CommercialParams {
  taxPct: number;
  taxEnabled: boolean;
  servicePct: number;
  serviceEnabled: boolean;
  depositPct: number;
  depositEnabled: boolean;
  igtfPct: number;
  igtfEnabled: boolean;
  quoteValidityDays: number;
  defaultMarkupPct: number;
  /** Umbral de alerta de margen bajo (%). Por debajo, la UI marca en rojo. */
  minMarginPct: number;
}

const DEFAULTS: CommercialParams = {
  taxPct: 16,
  taxEnabled: true,
  servicePct: 10,
  serviceEnabled: true,
  depositPct: 10,
  depositEnabled: true,
  igtfPct: 3,
  igtfEnabled: true,
  quoteValidityDays: 7,
  defaultMarkupPct: 30,
  minMarginPct: 20,
};

/** Lee los parámetros comerciales de la tabla Setting (con defaults seguros). */
export async function getCommercialParams(): Promise<CommercialParams> {
  const rows = await getAllSettings();
  const map = new Map(rows.map((r) => [r.key, r]));

  const num = (key: string, def: number) => {
    const row = map.get(key);
    if (!row) return def;
    const v = parseFloat(row.value);
    return Number.isNaN(v) ? def : v;
  };
  const enabled = (key: string, def: boolean) => map.get(key)?.enabled ?? def;

  return {
    taxPct: num(SETTING_KEYS.IVA_PCT, DEFAULTS.taxPct),
    taxEnabled: enabled(SETTING_KEYS.IVA_PCT, true),
    servicePct: num(SETTING_KEYS.SERVICE_PCT, DEFAULTS.servicePct),
    serviceEnabled: enabled(SETTING_KEYS.SERVICE_PCT, true),
    depositPct: num(SETTING_KEYS.DEPOSIT_PCT, DEFAULTS.depositPct),
    depositEnabled: enabled(SETTING_KEYS.DEPOSIT_PCT, true),
    igtfPct: num(SETTING_KEYS.IGTF_PCT, DEFAULTS.igtfPct),
    igtfEnabled: enabled(SETTING_KEYS.IGTF_PCT, true),
    quoteValidityDays: num(SETTING_KEYS.QUOTE_VALIDITY_DAYS, DEFAULTS.quoteValidityDays),
    defaultMarkupPct: num(SETTING_KEYS.DEFAULT_MARKUP_PCT, DEFAULTS.defaultMarkupPct),
    // Si el umbral está deshabilitado o en 0, se usa el default (20%).
    minMarginPct:
      enabled(SETTING_KEYS.MIN_MARGIN_PCT, false) &&
      num(SETTING_KEYS.MIN_MARGIN_PCT, 0) > 0
        ? num(SETTING_KEYS.MIN_MARGIN_PCT, DEFAULTS.minMarginPct)
        : DEFAULTS.minMarginPct,
  };
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await getAllSettings();
  return rows.find((r) => r.key === key)?.value ?? null;
}

export interface CommercialGoals {
  /** Meta de ventas/cobranza mensual en USD. */
  monthlySales: number;
  /** Meta de espacios (salones) comercializados por mes. */
  monthlySpaces: number;
  /** Meta de conversión de cierres (%). */
  conversionPct: number;
}

const GOAL_DEFAULTS: CommercialGoals = {
  monthlySales: 80000,
  monthlySpaces: 6,
  conversionPct: 80,
};

/** Lee las metas comerciales de la tabla Setting (con defaults seguros). */
export async function getGoals(): Promise<CommercialGoals> {
  const rows = (await getAllSettings()).filter((r) => r.category === "metas");
  const map = new Map(rows.map((r) => [r.key, r]));
  const num = (key: string, def: number) => {
    const row = map.get(key);
    if (!row || !row.enabled) return def;
    const v = parseFloat(row.value);
    return Number.isNaN(v) ? def : v;
  };
  return {
    monthlySales: num(SETTING_KEYS.GOAL_MONTHLY_SALES, GOAL_DEFAULTS.monthlySales),
    monthlySpaces: num(SETTING_KEYS.GOAL_MONTHLY_SPACES, GOAL_DEFAULTS.monthlySpaces),
    conversionPct: num(SETTING_KEYS.GOAL_CONVERSION_PCT, GOAL_DEFAULTS.conversionPct),
  };
}
