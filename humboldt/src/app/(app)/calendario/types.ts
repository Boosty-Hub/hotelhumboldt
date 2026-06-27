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
  /** Etiqueta a mostrar: contacto/evento, o motivo del bloqueo de mantenimiento. */
  eventName: string;
  opportunityId: string | null;
  opportunityCode: string | null;
  opportunityTitle: string | null;
  clientName: string | null;
  /** Contacto de la reserva (reservas manuales por contacto). */
  contactName: string | null;
  /** Cotización vinculada (opcional). */
  quoteNumber: string | null;
}

export interface ConflictDTO {
  spaceId: string;
  spaceName: string;
  spaceColor: string;
  dateKey: string;
  eventNames: string[];
}

/** Contacto para crear una reserva (la reserva se hace por contacto). */
export interface ContactOptionDTO {
  id: string;
  name: string;
  /** Empresas a las que pertenece (para distinguir homónimos); puede estar vacío. */
  clientNames: string[];
}

/** Cotización abierta que se puede vincular (opcional) a la reserva. */
export interface OpenQuoteOptionDTO {
  id: string;
  number: string;
  /** Cliente/evento de la cotización, para identificarla. */
  description: string;
}

/** Colores de badge por estado de reserva (no existen en constants.ts). */
export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  TENTATIVA: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELADA: "bg-rose-100 text-rose-800 border-rose-200",
};
