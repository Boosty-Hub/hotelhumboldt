// Tipos y constantes locales del módulo Pagos y Cobranza.
// (Las constantes de facturas/buckets no existen en src/lib/constants.ts —
//  se definen aquí para no tocar lib compartido.)

// ── Buckets de imputación de pagos ───────────────────────────────────
export const ALLOCATION_BUCKETS = [
  "MISCELANEOS",
  "TRASLADOS",
  "ALIMENTOS_BEBIDAS",
  "ESPACIOS",
  "GARANTIA",
] as const;
export type AllocationBucket = (typeof ALLOCATION_BUCKETS)[number];

export const ALLOCATION_BUCKET_LABELS: Record<string, string> = {
  MISCELANEOS: "Misceláneos",
  TRASLADOS: "Traslados",
  ALIMENTOS_BEBIDAS: "Alimentos y Bebidas",
  ESPACIOS: "Espacios",
  GARANTIA: "Garantía",
  GENERAL: "General",
};

// ── Facturas ─────────────────────────────────────────────────────────
export const INVOICE_TYPES = ["FISCAL", "PROFORMA", "ADICIONALES"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  FISCAL: "Fiscal",
  PROFORMA: "Proforma",
  ADICIONALES: "Adicionales",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  EMITIDA: "Emitida",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  EMITIDA: "bg-sky-100 text-sky-800 border-sky-200",
  PAGADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ANULADA: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export const RETENTION_TYPES = ["IVA", "ISLR"] as const;

// ── Cuotas ───────────────────────────────────────────────────────────
export const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
};

export const INSTALLMENT_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-zinc-100 text-zinc-700 border-zinc-200",
  PARCIAL: "bg-amber-100 text-amber-800 border-amber-200",
  PAGADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  VENCIDA: "bg-rose-100 text-rose-800 border-rose-200",
};

// ── Marcadores de movimientos de garantía (en notas del Payment) ─────
export const GARANTIA_DEVOLUCION_MARKER = "[Devolución de garantía]";
export const GARANTIA_APLICACION_MARKER = "[Garantía aplicada al saldo]";

// ── DTOs serializables (fechas como ISO string) ──────────────────────

export interface InstallmentDTO {
  id: string;
  label: string;
  dueDate: string; // ISO
  amount: number;
  status: string; // PENDIENTE | PARCIAL | PAGADA (VENCIDA se calcula al mostrar)
  paidUsd: number;
}

export interface UnassignedPaymentDTO {
  id: string;
  label: string; // "12/06/2026 · $500,00 · Zelle"
  amountUsd: number;
}

export interface CxcRow {
  quoteId: string;
  number: string;
  status: string;
  clientName: string;
  opportunityId: string;
  opportunityTitle: string;
  totalUsd: number;
  depositAmount: number; // garantía pactada en la cotización
  garantiaRecibida: number; // garantía efectivamente recibida
  pagado: number; // abonos + anticipos + reintegros genéricos
  retencionesUsd: number; // retenciones que cuentan como pago (ref USD)
  saldo: number;
  hasOverdue: boolean;
  nextInstallment: {
    label: string;
    dueDate: string;
    amount: number;
    overdue: boolean;
  } | null;
  installments: InstallmentDTO[];
  unassignedPayments: UnassignedPaymentDTO[];
}

export interface PaymentRow {
  id: string;
  date: string; // ISO
  clientName: string;
  opportunityId: string;
  opportunityTitle: string;
  quoteNumber: string | null;
  installmentLabel: string | null;
  method: string;
  type: string;
  currency: string;
  amountOriginal: number;
  rateUsed: number | null;
  amountUsd: number;
  reference: string | null;
  notes: string | null;
}

export interface InvoiceRow {
  id: string;
  number: string;
  date: string; // ISO
  clientName: string;
  opportunityId: string;
  opportunityTitle: string;
  quoteNumber: string | null;
  type: string;
  amountBs: number | null;
  amountUsdRef: number;
  rateUsed: number | null;
  status: string;
  retentions: { id: string; type: string; amountBs: number }[];
}

/** Opción del combobox cotización/oportunidad de los diálogos. */
export interface TargetOption {
  value: string; // "Q:<quoteId>" | "O:<opportunityId>"
  kind: "QUOTE" | "OPP";
  quoteId: string | null;
  opportunityId: string;
  label: string; // "COT-2026-0001 · IANCARINA C.A."
  sublabel: string; // título de la oportunidad
  totalUsd: number | null;
  installments: InstallmentDTO[];
}
