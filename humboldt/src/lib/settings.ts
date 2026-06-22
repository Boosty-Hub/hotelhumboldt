import { prisma } from "./prisma";
import { SETTING_KEYS } from "./constants";

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
  const rows = await prisma.setting.findMany();
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
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
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
  const rows = await prisma.setting.findMany({ where: { category: "metas" } });
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
