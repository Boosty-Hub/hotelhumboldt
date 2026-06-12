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
import type { Section } from "./constants";

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
  taxableBase: number; // Misc + AyB + Espacios
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
  const qty = line.costQuantity ?? line.quantity;
  return round2(line.unitCost * qty);
}

export function calcQuoteTotals(lines: CalcLine[], p: QuoteParams): QuoteTotals {
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

  const taxableBase = round2(subtotalMisc + subtotalFood + subtotalSpaces);
  const serviceAmount = p.serviceEnabled
    ? round2(subtotalFood * (p.servicePct / 100))
    : 0;
  const taxAmount = p.taxEnabled ? round2(taxableBase * (p.taxPct / 100)) : 0;
  const totalUsd = round2(taxableBase + subtotalTransfers + serviceAmount + taxAmount);
  const depositAmount = p.depositEnabled
    ? round2(totalUsd * (p.depositPct / 100))
    : 0;
  const totalWithDeposit = round2(totalUsd + depositAmount);
  const igtfAmount = p.igtfEnabled ? round2(totalUsd * (p.igtfPct / 100)) : 0;

  const grossMargin = round2(taxableBase + subtotalTransfers - totalCost);
  const revenueBeforeTax = taxableBase + subtotalTransfers;
  const grossMarginPct =
    revenueBeforeTax > 0 ? round2((grossMargin / revenueBeforeTax) * 100) : 0;

  return {
    subtotalMisc,
    subtotalTransfers,
    subtotalFood,
    subtotalSpaces,
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
