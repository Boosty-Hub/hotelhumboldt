// Tipos compartidos del módulo Pipeline
import type { Prisma } from "@prisma/client";

/**
 * Include de una oportunidad para las tarjetas del tablero (kanban + lista).
 * NO trae `activities` ni `tasks`: esos datos solo se usan en el sheet de detalle
 * y se cargan bajo demanda al abrirlo (ver `getOpportunityActivityAndTasks`).
 * Cargarlos aquí inflaba el payload del tablero con hasta 30 actividades y
 * 50 tareas POR cada oportunidad.
 */
export const OPPORTUNITY_BOARD_INCLUDE = {
  client: { select: { id: true, legalName: true, brandName: true } },
  contact: { select: { id: true, name: true, phone: true, email: true } },
  owner: { select: { id: true, name: true } },
  quotes: {
    select: { id: true, number: true, status: true, totalUsd: true },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.OpportunityInclude;

/**
 * Include completo (tarjeta + actividades + tareas). Ya no se usa para cargar el
 * tablero; se conserva como fuente única del shape del detalle, del que derivan
 * `PipelineActivity` y `PipelineTask`, y que replica `getOpportunityActivityAndTasks`.
 */
export const OPPORTUNITY_INCLUDE = {
  ...OPPORTUNITY_BOARD_INCLUDE,
  activities: {
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
    // El timeline del Sheet solo muestra las recientes; sin tope el payload
    // crecería sin límite con el histórico de la oportunidad.
    take: 30,
  },
  tasks: {
    where: { status: { not: "CANCELADA" } },
    orderBy: { dueAt: "asc" },
    include: { assignee: { select: { id: true, name: true } } },
    take: 50,
  },
} satisfies Prisma.OpportunityInclude;

/** Oportunidad tal y como la consume el tablero (sin activities/tasks). */
export type PipelineOpportunity = Prisma.OpportunityGetPayload<{
  include: typeof OPPORTUNITY_BOARD_INCLUDE;
}>;

/** Detalle (activities + tasks) que carga el sheet bajo demanda. */
type OpportunityDetail = Prisma.OpportunityGetPayload<{
  include: typeof OPPORTUNITY_INCLUDE;
}>;

export type PipelineActivity = OpportunityDetail["activities"][number];
export type PipelineTask = OpportunityDetail["tasks"][number];

/** Carga diferida del sheet: mismo shape que antes embebía OPPORTUNITY_INCLUDE. */
export type OpportunityActivityAndTasks = {
  activities: PipelineActivity[];
  tasks: PipelineTask[];
};

export interface BasicUser {
  id: string;
  name: string;
  role: string;
}

export interface BasicClient {
  id: string;
  legalName: string;
  brandName: string | null;
}

/** Contacto del directorio con sus empresas (0, 1 o varias), para crear oportunidad. */
export interface BasicContact {
  id: string;
  name: string;
  title: string | null;
  clients: { id: string; name: string }[];
}

/** Iniciales para el avatar del responsable. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
