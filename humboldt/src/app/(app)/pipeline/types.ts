// Tipos compartidos del módulo Pipeline
import type { Prisma } from "@prisma/client";

/** Include estándar de una oportunidad para el tablero y el sheet de detalle. */
export const OPPORTUNITY_INCLUDE = {
  client: { select: { id: true, legalName: true, brandName: true } },
  contact: { select: { id: true, name: true, phone: true, email: true } },
  owner: { select: { id: true, name: true } },
  quotes: {
    select: { id: true, number: true, status: true, totalUsd: true },
    orderBy: { createdAt: "desc" },
  },
  activities: {
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
    // El timeline del Sheet solo muestra las recientes; sin tope el payload del
    // tablero crecería sin límite con el histórico de todas las oportunidades.
    take: 30,
  },
  tasks: {
    where: { status: { not: "CANCELADA" } },
    orderBy: { dueAt: "asc" },
    include: { assignee: { select: { id: true, name: true } } },
    take: 50,
  },
} satisfies Prisma.OpportunityInclude;

export type PipelineOpportunity = Prisma.OpportunityGetPayload<{
  include: typeof OPPORTUNITY_INCLUDE;
}>;

export type PipelineActivity = PipelineOpportunity["activities"][number];

export type PipelineTask = PipelineOpportunity["tasks"][number];

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

/** Iniciales para el avatar del responsable. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
