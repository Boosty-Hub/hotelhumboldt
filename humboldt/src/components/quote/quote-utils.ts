// Utilidades puras del módulo Cotizador — sin imports de auth/prisma,
// usables tanto en server como en client components.

import type { Section } from "@/lib/constants";

/**
 * Las versiones >1 guardan el número como "COT-2026-0012-V2" (number es @unique).
 * Para mostrar al usuario siempre se usa el número base + badge de versión.
 */
export function quoteBaseNumber(number: string): string {
  return number.replace(/-V\d+$/, "");
}

/** Línea tal como vive en el estado del editor (client). */
export interface EditorLine {
  /** id real en BD si la línea ya existía (para preservar costos internos) */
  id?: string;
  uid: string; // clave local de React
  section: Section;
  dayNumber: number | null;
  productId: string | null;
  description: string;
  comment: string;
  listPrice: number | null;
  unitPrice: number;
  quantity: number;
  unit: string;
  isOptional: boolean;
  taxExempt: boolean;
  sortOrder: number;
  // Trazabilidad de precio especial
  discountType: string | null;
  discountReason: string | null;
  discountAuthorName: string | null;
  // Costeo interno (solo presentes si canViewCosts)
  unitCost: number | null;
  costQuantity: number | null;
  supplierId: string | null;
}

/** Producto del catálogo tal como lo recibe el editor. */
export interface CatalogProduct {
  id: string;
  name: string;
  categoryName: string;
  section: Section | null; // sección sugerida por la categoría
  type: string;
  unit: string;
  listPrice: number | null;
  minPax: number | null;
  unitsPerPax: number | null;
  priceContext: string | null;
  // internos — solo se envían al cliente si canViewCosts
  cost: number | null;
  supplierId: string | null;
}

/** Payload de una línea que viaja del editor a la server action. */
export interface SaveLineInput {
  id?: string;
  section: string;
  dayNumber: number | null;
  productId: string | null;
  description: string;
  comment: string | null;
  listPrice: number | null;
  unitPrice: number;
  quantity: number;
  unit: string;
  isOptional: boolean;
  taxExempt: boolean;
  sortOrder: number;
  discountType: string | null;
  discountReason: string | null;
  unitCost?: number | null;
  costQuantity?: number | null;
  supplierId?: string | null;
}

/** % de variación del precio respecto a lista, para el badge "Precio especial −15%". */
export function priceDeltaPct(unitPrice: number, listPrice: number): number {
  if (!listPrice) return 0;
  return Math.round(((unitPrice - listPrice) / listPrice) * 100);
}
