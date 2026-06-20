// Constantes del módulo BEO (Banquet Event Order).

/** Departamentos del hotel que reciben instrucciones en el BEO (orden del formato real). */
export const BEO_DEPARTMENTS = [
  { key: "ATENCION_CLIENTE", label: "Atención al cliente" },
  { key: "AMA_LLAVES", label: "Ama de llaves" },
  { key: "ALIMENTOS_BEBIDAS", label: "Alimentos y Bebidas" },
  { key: "COCINA", label: "Cocina" },
  { key: "PREVENCION_SEGURIDAD", label: "Prevención, Seguridad y Riesgos" },
  { key: "INGENIERIA", label: "Ingeniería" },
  { key: "UTILERIA", label: "Utilería" },
  { key: "SEGURIDAD_LABORAL", label: "Seguridad laboral" },
  { key: "VENTAS", label: "Ventas" },
] as const;

export type BeoDepartmentKey = (typeof BEO_DEPARTMENTS)[number]["key"];

/** Color de cabecera de cada departamento en el BEO: un único azul, sobrio y uniforme. */
export const BEO_DEPARTMENT_HEADER = "bg-sky-800 text-white";

export const BEO_STATUSES = ["BORRADOR", "EMITIDO"] as const;
export type BeoStatus = (typeof BEO_STATUSES)[number];

export const BEO_STATUS_LABELS: Record<BeoStatus, string> = {
  BORRADOR: "Borrador",
  EMITIDO: "Emitido",
};

export const BEO_STATUS_COLORS: Record<BeoStatus, string> = {
  BORRADOR: "bg-amber-100 text-amber-800 border-amber-200",
  EMITIDO: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

// ── Tipos del contenido estructurado (JSON) ──────────────────────────────
export interface BeoScheduleItem {
  // El día es el de la fecha del BEO; aquí solo hora + descripción (run-of-show).
  time: string; // ej. "08:00 AM"
  description: string;
}

export interface BeoMenuSection {
  section: string; // ej. "Estación Líquida", "Pasapalos", "Buffet"
  items: string[];
}

export interface BeoDepartmentReq {
  key: string;
  label: string;
  instructions: string;
}
