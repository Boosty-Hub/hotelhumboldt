// Constantes y helpers compartidos del módulo Catálogo.
// (Locales al módulo: PIEZA/BUFFET/EMPLATADO no están en lib/constants.)

import { round2 } from "@/lib/money";
import { UNIT_LABELS, type Unit } from "@/lib/constants";

export const PRICE_CONTEXTS = ["PIEZA", "BUFFET", "EMPLATADO"] as const;
export type PriceContext = (typeof PRICE_CONTEXTS)[number];

export const PRICE_CONTEXT_LABELS: Record<PriceContext, string> = {
  PIEZA: "Por pieza",
  BUFFET: "Buffet",
  EMPLATADO: "Emplatado",
};

/** Colores de badge por tipo de producto (estilo *_COLORS de constants). */
export const PRODUCT_TYPE_COLORS: Record<string, string> = {
  PROPIO: "bg-sky-100 text-sky-800 border-sky-200",
  PROVEEDOR: "bg-violet-100 text-violet-800 border-violet-200",
  ESPACIO: "bg-indigo-100 text-indigo-800 border-indigo-200",
  HOSPEDAJE: "bg-teal-100 text-teal-800 border-teal-200",
  SERVICIO: "bg-amber-100 text-amber-800 border-amber-200",
  INSUMO: "bg-zinc-100 text-zinc-700 border-zinc-200",
  COMODIN: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
};

/** Etiquetas cortas para celdas (la de constants dice "Comodín (precio manual)"). */
export const PRODUCT_TYPE_SHORT_LABELS: Record<string, string> = {
  PROPIO: "Propio",
  PROVEEDOR: "Proveedor",
  ESPACIO: "Espacio",
  HOSPEDAJE: "Hospedaje",
  SERVICIO: "Servicio",
  INSUMO: "Insumo",
  COMODIN: "Comodín",
};

/** Umbral de alerta de margen (%): por debajo se resalta en rojo. */
export const MIN_MARGIN_WARN_PCT = 20;

/** Margen bruto % = (precio − costo) / precio. Null si no es calculable. */
export function calcMarginPct(
  listPrice: number | null | undefined,
  cost: number | null | undefined
): number | null {
  if (listPrice == null || listPrice <= 0 || cost == null) return null;
  return round2(((listPrice - cost) / listPrice) * 100);
}

/** Etiqueta de unidad tolerante a valores fuera del catálogo de UNITS. */
export function unitLabel(unit: string): string {
  return UNIT_LABELS[unit as Unit] ?? unit;
}

// ── Tipos serializables compartidos entre server y client components ──

export interface ProductRow {
  id: string;
  name: string;
  categoryId: string | null;
  type: string;
  unit: string;
  listPrice: number | null;
  cost: number | null;
  supplierId: string | null;
  minPax: number | null;
  unitsPerPax: number | null;
  priceContext: string | null;
  notes: string | null;
  active: boolean;
  category: { id: string; name: string } | null;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface CategoryRow extends CategoryOption {
  sortOrder: number;
  productCount: number;
}

export interface SupplierOption {
  id: string;
  name: string;
}
