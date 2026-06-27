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
 * Genera el BEO a partir de una RESERVA de salón CONFIRMADA.
 *
 * Cubre los dos orígenes de un evento confirmado:
 *  • Reserva originada en una cotización (tiene `event` y `quote`) → el BEO se
 *    ata al EVENTO (1 BEO por evento; evita duplicados en eventos multi-día).
 *  • Reserva manual por contacto (sin evento) → el BEO se ata a la RESERVA.
 *
 * Autocompleta la cabecera (salón, fecha, hora, cliente, responsable) y el menú
 * desde la cotización vinculada, si la hay. Si ya existe, devuelve el existente.
 */
export async function generateBeoFromReservation(reservationId: string): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };
  if (!reservationId) return { ok: false, error: "Reserva inválida." };

  const reservation = await prisma.spaceReservation.findUnique({
    where: { id: reservationId },
    include: {
      space: { select: { name: true } },
      beo: { select: { id: true } },
      contact: {
        select: {
          name: true,
          clientLinks: {
            take: 1,
            orderBy: { isPrimary: "desc" },
            include: { client: { select: { brandName: true, legalName: true } } },
          },
        },
      },
      event: {
        include: {
          beo: { select: { id: true } },
          opportunity: { include: { client: true, owner: { select: { name: true } } } },
          quotes: { orderBy: { createdAt: "desc" }, take: 1, include: { lines: true } },
        },
      },
      quote: {
        include: {
          lines: true,
          opportunity: { include: { client: true, owner: { select: { name: true } } } },
        },
      },
    },
  });
  if (!reservation) return { ok: false, error: "La reserva no existe." };
  if (reservation.type !== "EVENTO") {
    return { ok: false, error: "Solo se genera BEO de reservas de evento (no de bloqueos de mantenimiento)." };
  }
  if (reservation.status !== "CONFIRMADA") {
    return { ok: false, error: "El BEO se genera solo desde una reserva confirmada." };
  }

  // ¿Ya tiene BEO? Por la propia reserva, o por su evento (reservas de cotización).
  if (reservation.beo) return { ok: true, id: reservation.beo.id };
  if (reservation.event?.beo) return { ok: true, id: reservation.event.beo.id };

  const event = reservation.event;
  // El menú sale de la cotización vinculada a la reserva, o de la última del evento.
  const menuQuote = reservation.quote ?? event?.quotes[0] ?? null;
  const menu = buildMenuFromQuote(menuQuote?.lines);

  // Cliente: evento→oportunidad, o cotización→oportunidad, o empresa del contacto.
  const client =
    event?.opportunity.client ??
    reservation.quote?.opportunity.client ??
    reservation.contact?.clientLinks[0]?.client ??
    null;
  const clientName = client?.brandName ?? client?.legalName ?? reservation.contact?.name ?? null;

  const ownerName =
    event?.opportunity.owner.name ?? reservation.quote?.opportunity.owner.name ?? null;

  const eventName = event?.name ?? reservation.title ?? reservation.contact?.name ?? "Evento";

  const last = await prisma.beo.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const number = (last?.number ?? 444) + 1; // continúa el correlativo actual (445…)

  const departments = BEO_DEPARTMENTS.map((d) => ({
    key: d.key,
    label: d.label,
    instructions: d.key === "VENTAS" && ownerName ? `Coordinación del evento: ${ownerName}.` : "",
  }));

  // Ata al EVENTO si la reserva proviene de una cotización; si es manual, a la RESERVA.
  const link = event ? { eventId: event.id } : { reservationId: reservation.id };

  const beo = await prisma.beo.create({
    data: {
      number,
      ...link,
      status: "BORRADOR",
      publicToken: nanoid(18),
      responsable: ownerName,
      eventName,
      clientName,
      spaceName: reservation.space.name,
      eventDate: event?.startDate ?? reservation.date,
      startTime: event?.startTime ?? reservation.startTime,
      pax: event?.pax ?? null,
      schedule: [],
      menu,
      departments,
      generalNotes: null,
    },
  });

  await logBeo(session.user, beo.id, "CREADO", `BEO ${number} generado para «${eventName}».`);
  revalidatePath("/beo");
  return { ok: true, id: beo.id };
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
