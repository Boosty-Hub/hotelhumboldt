// Constantes y tipos compartidos del módulo Proveedores.
// (Los estados de SupplierEventCost no están en lib/constants — viven aquí.)

export const SUPPLIER_COST_STATUSES = [
  "COTIZADO",
  "NEGOCIADO",
  "CONFIRMADO",
  "PAGADO",
] as const;
export type SupplierCostStatus = (typeof SUPPLIER_COST_STATUSES)[number];

export const SUPPLIER_COST_STATUS_LABELS: Record<string, string> = {
  COTIZADO: "Cotizado",
  NEGOCIADO: "Negociado",
  CONFIRMADO: "Confirmado",
  PAGADO: "Pagado",
};

export const SUPPLIER_COST_STATUS_COLORS: Record<string, string> = {
  COTIZADO: "bg-zinc-100 text-zinc-700 border-zinc-200",
  NEGOCIADO: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PAGADO: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

/** Fila de proveedor serializable para client components. */
export interface SupplierRow {
  id: string;
  name: string;
  serviceType: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  discountPct: number | null;
  appliesIva: boolean;
  conditions: string | null;
  active: boolean;
  productCount: number;
}
