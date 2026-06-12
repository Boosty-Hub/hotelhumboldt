// Metadatos visuales locales del módulo Pipeline
// (los tipos de Activity no están en src/lib/constants.ts — se definen aquí)
import {
  StickyNote,
  Phone,
  Mail,
  UsersRound,
  UtensilsCrossed,
  ArrowRight,
  History,
} from "lucide-react";
import type { Stage } from "@/lib/constants";

export type IconComponent = React.ComponentType<{ className?: string }>;

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  NOTA: "Nota",
  LLAMADA: "Llamada",
  EMAIL: "Correo",
  REUNION: "Reunión",
  DEGUSTACION: "Degustación",
  CAMBIO_ETAPA: "Cambio de etapa",
  SISTEMA: "Sistema",
};

export const ACTIVITY_TYPE_ICONS: Record<string, IconComponent> = {
  NOTA: StickyNote,
  LLAMADA: Phone,
  EMAIL: Mail,
  REUNION: UsersRound,
  DEGUSTACION: UtensilsCrossed,
  CAMBIO_ETAPA: ArrowRight,
  SISTEMA: History,
};

/** Punto de color del encabezado de cada columna. */
export const STAGE_DOT: Record<Stage, string> = {
  NUEVO: "bg-sky-500",
  CONTACTADO: "bg-violet-500",
  PROPUESTA: "bg-amber-500",
  NEGOCIACION: "bg-orange-500",
  GANADO: "bg-emerald-500",
  PERDIDO: "bg-rose-500",
};
