// Tipos y constantes compartidas del módulo Salones

export interface SpaceDTO {
  id: string;
  name: string;
  dailyRate: number | null;
  halfDayRate: number | null;
  capacity: number | null;
  capacityNotes: string | null;
  description: string | null;
  color: string;
  active: boolean;
  sortOrder: number;
}

/** Paleta de colores disponible para los salones en el calendario. */
export const SPACE_COLOR_PALETTE: { value: string; label: string }[] = [
  { value: "#0ea5e9", label: "Celeste" },
  { value: "#6366f1", label: "Índigo" },
  { value: "#8b5cf6", label: "Violeta" },
  { value: "#ec4899", label: "Rosado" },
  { value: "#ef4444", label: "Rojo" },
  { value: "#f97316", label: "Naranja" },
  { value: "#f59e0b", label: "Ámbar" },
  { value: "#84cc16", label: "Lima" },
  { value: "#10b981", label: "Esmeralda" },
  { value: "#06b6d4", label: "Turquesa" },
];
