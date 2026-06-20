// Tipos y constantes compartidas del módulo Calendario
import type { ReservationStatus } from "@/lib/constants";

export interface CalendarSpaceDTO {
  id: string;
  name: string;
  color: string;
  capacity: number | null;
}

export interface ReservationDTO {
  id: string;
  spaceId: string;
  /** Día reservado en formato yyyy-MM-dd (derivado de la fecha UTC). */
  dateKey: string;
  startTime: string | null;
  endTime: string | null;
  status: ReservationStatus;
  notes: string | null;
  type: "EVENTO" | "MANTENIMIENTO";
  eventId: string | null;
  /** Etiqueta a mostrar: nombre del evento, o título del bloqueo de mantenimiento. */
  eventName: string;
  opportunityId: string | null;
  opportunityCode: string | null;
  opportunityTitle: string | null;
  clientName: string | null;
}

export interface ConflictDTO {
  spaceId: string;
  spaceName: string;
  spaceColor: string;
  dateKey: string;
  eventNames: string[];
}

export interface EventOptionDTO {
  id: string;
  name: string;
  clientName: string;
  opportunityCode: string;
}

export interface OpportunityOptionDTO {
  id: string;
  code: string;
  title: string;
  clientName: string;
}

/** Colores de badge por estado de reserva (no existen en constants.ts). */
export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  TENTATIVA: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELADA: "bg-rose-100 text-rose-800 border-rose-200",
};
