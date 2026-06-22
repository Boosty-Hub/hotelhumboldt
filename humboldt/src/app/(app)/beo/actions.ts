"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BEO_DEPARTMENTS, type BeoMenuSection } from "./constants";

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function logBeo(
  user: { id: string; name?: string | null } | null | undefined,
  beoId: string,
  action: string,
  detail?: string
): Promise<void> {
  await prisma.beoLog.create({
    data: {
      beoId,
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      action,
      detail: detail ?? null,
    },
  });
}

/** Arma el menú del BEO desde las líneas de Alimentos y Bebidas de la cotización. */
function buildMenuFromQuote(
  lines: { section: string; description: string; quantity: number; unit: string }[] | undefined
): BeoMenuSection[] {
  if (!lines || lines.length === 0) return [];
  const ayb = lines.filter((l) => l.section === "ALIMENTOS_BEBIDAS");
  if (ayb.length === 0) return [];
  return [
    {
      section: "Alimentos y Bebidas",
      items: ayb.map((l) => {
        const qty = l.quantity ? `${l.quantity % 1 === 0 ? l.quantity : l.quantity} ${l.unit} · ` : "";
        return `${qty}${l.description}`;
      }),
    },
  ];
}

/**
 * Genera el BEO de un evento, autocompletando del evento → oportunidad → cliente
 * y el menú desde la cotización. Si ya existe, devuelve el existente.
 */
export async function generateBeo(eventId: string): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };
  if (!eventId) return { ok: false, error: "Evento inválido." };

  const existing = await prisma.beo.findUnique({ where: { eventId }, select: { id: true } });
  if (existing) return { ok: true, id: existing.id };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      opportunity: {
        include: { client: true, owner: { select: { name: true } } },
      },
      quotes: { orderBy: { createdAt: "desc" }, take: 1, include: { lines: true } },
      reservations: { include: { space: { select: { name: true } } }, take: 1 },
    },
  });
  if (!event) return { ok: false, error: "El evento no existe." };

  // El BEO solo va atado a un evento ganado: oportunidad GANADO o cotización
  // aprobada/contratada. Si no, no se genera.
  const wonQuotes = await prisma.quote.count({
    where: { eventId, status: { in: ["APROBADA", "CONTRATADA"] } },
  });
  if (event.opportunity.stage !== "GANADO" && wonQuotes === 0) {
    return {
      ok: false,
      error:
        "El BEO solo se genera para eventos con cotización aprobada o contratada (oportunidad ganada).",
    };
  }

  const last = await prisma.beo.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const number = (last?.number ?? 444) + 1; // continúa el correlativo actual (445…)

  const client = event.opportunity.client;
  const space = event.reservations[0]?.space?.name ?? null;
  const menu = buildMenuFromQuote(event.quotes[0]?.lines);
  const departments = BEO_DEPARTMENTS.map((d) => ({
    key: d.key,
    label: d.label,
    instructions:
      d.key === "VENTAS" ? `Coordinación del evento: ${event.opportunity.owner.name}.` : "",
  }));

  const beo = await prisma.beo.create({
    data: {
      number,
      eventId,
      status: "BORRADOR",
      publicToken: nanoid(18),
      responsable: event.opportunity.owner.name,
      eventName: event.name,
      clientName: client.brandName || client.legalName,
      spaceName: space,
      eventDate: event.startDate,
      startTime: event.startTime,
      pax: event.pax,
      schedule: [],
      menu,
      departments,
      generalNotes: null,
    },
  });

  await logBeo(session.user, beo.id, "CREADO", `BEO ${number} generado para «${event.name}».`);
  revalidatePath("/beo");
  return { ok: true, id: beo.id };
}

/**
 * Genera el BEO a partir de una oportunidad ganada / cotización aprobada.
 * Si la oportunidad no tiene un evento usable, lo crea desde sus datos y vincula
 * la última cotización (para que el BEO traiga el menú). Luego delega en generateBeo.
 */
export async function generateBeoFromOpportunity(opportunityId: string): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };
  if (!opportunityId) return { ok: false, error: "Oportunidad inválida." };

  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      events: { include: { beo: { select: { id: true } } }, orderBy: { createdAt: "asc" } },
      quotes: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, eventId: true } },
    },
  });
  if (!opp) return { ok: false, error: "La oportunidad no existe." };

  // Evento sin BEO; si no hay, se crea desde la oportunidad.
  let eventId = opp.events.find((e) => !e.beo)?.id ?? null;
  if (!eventId) {
    const created = await prisma.event.create({
      data: {
        opportunityId,
        name: opp.title,
        startDate: opp.expectedEventDate ?? null,
        pax: opp.pax ?? null,
      },
    });
    const latest = opp.quotes[0];
    if (latest && !latest.eventId) {
      await prisma.quote.update({ where: { id: latest.id }, data: { eventId: created.id } });
    }
    eventId = created.id;
  }

  return generateBeo(eventId);
}

export async function updateBeo(input: {
  id: string;
  responsable?: string | null;
  eventName?: string | null;
  clientName?: string | null;
  spaceName?: string | null;
  eventDate?: string | null;
  startTime?: string | null;
  pax?: number | null;
  schedule?: unknown;
  menu?: unknown;
  departments?: unknown;
  generalNotes?: string | null;
}): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };
  if (!input.id) return { ok: false, error: "BEO inválido." };

  const beo = await prisma.beo.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!beo) return { ok: false, error: "El BEO no existe." };

  await prisma.beo.update({
    where: { id: input.id },
    data: {
      responsable: input.responsable ?? undefined,
      eventName: input.eventName ?? undefined,
      clientName: input.clientName ?? undefined,
      spaceName: input.spaceName === undefined ? undefined : input.spaceName,
      eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
      startTime: input.startTime === undefined ? undefined : input.startTime,
      pax: input.pax === undefined ? undefined : input.pax,
      schedule: input.schedule === undefined ? undefined : (input.schedule as object),
      menu: input.menu === undefined ? undefined : (input.menu as object),
      departments: input.departments === undefined ? undefined : (input.departments as object),
      generalNotes: input.generalNotes === undefined ? undefined : input.generalNotes,
    },
  });

  await logBeo(session.user, input.id, "MODIFICADO", "BEO actualizado.");
  revalidatePath("/beo");
  revalidatePath(`/beo/${input.id}`);
  return { ok: true };
}

export async function setBeoStatus(input: { id: string; status: "BORRADOR" | "EMITIDO" }): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };

  const beo = await prisma.beo.findUnique({ where: { id: input.id }, select: { id: true, number: true } });
  if (!beo) return { ok: false, error: "El BEO no existe." };

  await prisma.beo.update({ where: { id: input.id }, data: { status: input.status } });
  await logBeo(
    session.user,
    input.id,
    input.status === "EMITIDO" ? "EMITIDO" : "MODIFICADO",
    input.status === "EMITIDO" ? `BEO ${beo.number} emitido.` : `BEO ${beo.number} vuelto a borrador.`
  );
  revalidatePath("/beo");
  revalidatePath(`/beo/${input.id}`);
  return { ok: true };
}

export type BeoLogEntry = {
  id: string;
  action: string;
  detail: string | null;
  userName: string | null;
  createdAt: string;
};

export async function getBeoLog(beoId: string): Promise<BeoLogEntry[]> {
  const session = await auth();
  if (!session?.user || !beoId) return [];
  const logs = await prisma.beoLog.findMany({
    where: { beoId },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    detail: l.detail,
    userName: l.userName,
    createdAt: l.createdAt.toISOString(),
  }));
}
