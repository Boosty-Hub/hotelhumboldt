// Motor de cálculo de cotizaciones — funciones puras, replican y corrigen
// la lógica real de los Excel del Hotel Humboldt:
//
//   SubTotal base IVA = Misceláneos + AyB (sin servicio) + Espacios
//   Traslados        → exentos de IVA, fuera de la base
//   Servicio (10%)   → SOLO sobre AyB, fuera de la base de IVA
//   IVA (16%)        → sobre el subtotal base
//   Total USD        = base + traslados + servicio + IVA
//   Garantía (10%)   → depósito reembolsable SEPARADO (no se suma al total)
//   IGTF (3%)        → informativo, aplica al pagar en divisas
//
// Todos los % vienen de la Configuración y se snapshotean en cada cotización.

import { round2 } from "./money";
import { SECTIONS, type Section } from "./constants";

export interface CalcLine {
  section: Section | string;
  unitPrice: number;
  quantity: number;
  isOptional?: boolean; // cantidad referencial: no suma
  taxExempt?: boolean;
  unitCost?: number | null;
  costQuantity?: number | null;
}

export interface QuoteParams {
  taxPct: number; // IVA, ej. 16
  taxEnabled: boolean;
  servicePct: number; // % servicio sobre AyB, ej. 10
  serviceEnabled: boolean;
  depositPct: number; // % garantía, ej. 10
  depositEnabled: boolean;
  igtfPct: number; // ej. 3
  igtfEnabled: boolean;
}

export interface QuoteTotals {
  subtotalMisc: number;
  subtotalTransfers: number; // exento de IVA
  subtotalFood: number; // AyB sin servicio
  subtotalSpaces: number;
  discountPct: number; // % de descuento de gerencia aplicado (0 = sin descuento)
  discountAmount: number; // monto descontado sobre el subtotal de venta
  taxableBase: number; // Misc + AyB + Espacios — NETO (tras descuento)
  serviceAmount: number; // servicio % sobre AyB
  taxAmount: number; // IVA sobre la base
  totalUsd: number; // lo que paga el cliente por el evento
  depositAmount: number; // garantía: depósito reembolsable APARTE
  totalWithDeposit: number; // total a movilizar (informativo)
  igtfAmount: number; // informativo: si paga todo en divisas
  // Internos (solo roles con permiso)
  totalCost: number;
  grossMargin: number;
  grossMarginPct: number;
}

export function lineSubtotal(line: CalcLine): number {
  if (line.isOptional) return 0;
  return round2(line.unitPrice * line.quantity);
}

export function lineCost(line: CalcLine): number {
  if (line.isOptional || line.unitCost == null) return 0;
  // El costo total usa SIEMPRE la cantidad del ítem (la misma que se cotiza).
  return round2(line.unitCost * line.quantity);
}

export function calcQuoteTotals(
  lines: CalcLine[],
  p: QuoteParams,
  discountPct = 0
): QuoteTotals {
  let subtotalMisc = 0;
  let subtotalTransfers = 0;
  let subtotalFood = 0;
  let subtotalSpaces = 0;
  let totalCost = 0;

  for (const line of lines) {
    const sub = lineSubtotal(line);
    totalCost += lineCost(line);
    switch (line.section) {
      case "MISCELANEOS":
        subtotalMisc += sub;
        break;
      case "TRASLADOS":
        subtotalTransfers += sub;
        break;
      case "ALIMENTOS_BEBIDAS":
        subtotalFood += sub;
        break;
      case "ESPACIOS":
        subtotalSpaces += sub;
        break;
    }
  }

  subtotalMisc = round2(subtotalMisc);
  subtotalTransfers = round2(subtotalTransfers);
  subtotalFood = round2(subtotalFood);
  subtotalSpaces = round2(subtotalSpaces);
  totalCost = round2(totalCost);

  // Descuento de gerencia: % sobre la BASE GRAVADA (Misc + AyB + Espacios),
  // ANTES de servicio e IVA. Los Traslados son exentos y quedan fuera del
  // descuento, así el desglose del documento cuadra. Clamp 0–100.
  const pct = Math.min(Math.max(discountPct, 0), 100);
  const grossTaxable = round2(subtotalMisc + subtotalFood + subtotalSpaces);
  const discountAmount = round2(grossTaxable * (pct / 100));
  const factor = 1 - pct / 100;

  // Montos netos (tras descuento) sobre los que se calculan servicio e IVA.
  const netFood = subtotalFood * factor;
  const taxableBase = round2(grossTaxable * factor);
  const serviceAmount = p.serviceEnabled ? round2(netFood * (p.servicePct / 100)) : 0;
  const taxAmount = p.taxEnabled ? round2(taxableBase * (p.taxPct / 100)) : 0;
  const totalUsd = round2(taxableBase + subtotalTransfers + serviceAmount + taxAmount);
  const depositAmount = p.depositEnabled
    ? round2(totalUsd * (p.depositPct / 100))
    : 0;
  const totalWithDeposit = round2(totalUsd + depositAmount);
  const igtfAmount = p.igtfEnabled ? round2(totalUsd * (p.igtfPct / 100)) : 0;

  // Margen sobre los ingresos NETOS realmente cobrados (post-descuento).
  const netRevenue = round2(taxableBase + subtotalTransfers);
  const grossMargin = round2(netRevenue - totalCost);
  const grossMarginPct =
    netRevenue > 0 ? round2((grossMargin / netRevenue) * 100) : 0;

  return {
    subtotalMisc,
    subtotalTransfers,
    subtotalFood,
    subtotalSpaces,
    discountPct: pct,
    discountAmount,
    taxableBase,
    serviceAmount,
    taxAmount,
    totalUsd,
    depositAmount,
    totalWithDeposit,
    igtfAmount,
    totalCost,
    grossMargin,
    grossMarginPct,
  };
}

/** Margen de una línea individual (vista interna). */
export function lineMarginPct(line: CalcLine): number | null {
  // Costo 0 es un valor legítimo (cortesía/espacio propio) → 100% de margen,
  // consistente con calcMarginPct del catálogo. Solo null si no hay costo.
  if (line.unitCost == null) return null;
  const revenue = lineSubtotal(line);
  const cost = lineCost(line);
  if (revenue === 0) return null;
  return round2(((revenue - cost) / revenue) * 100);
}

/** Detecta si una línea tiene precio distinto al de lista (requiere motivo). */
export function isPriceOverride(unitPrice: number, listPrice: number | null | undefined): boolean {
  if (listPrice == null) return false;
  return round2(unitPrice) !== round2(listPrice);
}

// ───────────────────── Análisis de costos (informe interno) ─────────────────────
// Desglose costo vs venta vs ganancia por línea y por sección, para que
// administración valide el margen. NUNCA debe exponerse al cliente.

export interface CostAnalysisLine {
  description: string;
  quantity: number;
  unit: string;
  isOptional: boolean;
  unitCost: number | null;
  cost: number; // costo total de la línea
  unitPrice: number;
  sale: number; // subtotal de venta
  profit: number; // venta − costo
  marginPct: number | null;
  hasCost: boolean; // false = costo no cargado (margen potencialmente inflado)
}

export interface CostAnalysisSection {
  section: Section;
  cost: number;
  sale: number;
  profit: number;
  marginPct: number | null;
  lines: CostAnalysisLine[];
}

export interface CostAnalysis {
  sections: CostAnalysisSection[];
  totalCost: number;
  totalSale: number; // ingresos del evento antes de impuestos (base + traslados)
  grossMargin: number;
  grossMarginPct: number;
  linesWithoutCost: number; // líneas con venta pero sin costo cargado
}

type CostInputLine = CalcLine & { description: string; unit: string };

/** Construye el desglose de costos/margen por sección e ítem desde las líneas. */
export function buildCostAnalysis(lines: CostInputLine[]): CostAnalysis {
  const bySection = new Map<string, CostAnalysisLine[]>();
  let linesWithoutCost = 0;

  for (const l of lines) {
    const sale = lineSubtotal(l);
    const cost = lineCost(l);
    const hasCost = l.unitCost != null;
    if (!hasCost && !l.isOptional && sale > 0) linesWithoutCost++;
    const profit = round2(sale - cost);
    const row: CostAnalysisLine = {
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      isOptional: Boolean(l.isOptional),
      unitCost: l.unitCost ?? null,
      cost,
      unitPrice: l.unitPrice,
      sale,
      profit,
      marginPct: sale > 0 ? round2((profit / sale) * 100) : null,
      hasCost,
    };
    const arr = bySection.get(String(l.section));
    if (arr) arr.push(row);
    else bySection.set(String(l.section), [row]);
  }

  const sections: CostAnalysisSection[] = [];
  for (const s of SECTIONS) {
    const rows = bySection.get(s);
    if (!rows || rows.length === 0) continue;
    const cost = round2(rows.reduce((a, r) => a + r.cost, 0));
    const sale = round2(rows.reduce((a, r) => a + r.sale, 0));
    const profit = round2(sale - cost);
    sections.push({
      section: s,
      cost,
      sale,
      profit,
      marginPct: sale > 0 ? round2((profit / sale) * 100) : null,
      lines: rows,
    });
  }

  const totalCost = round2(sections.reduce((a, s) => a + s.cost, 0));
  const totalSale = round2(sections.reduce((a, s) => a + s.sale, 0));
  const grossMargin = round2(totalSale - totalCost);
  const grossMarginPct = totalSale > 0 ? round2((grossMargin / totalSale) * 100) : 0;

  return { sections, totalCost, totalSale, grossMargin, grossMarginPct, linesWithoutCost };
}
