import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { dateTimeFilter, hasDateRange, parseDateRange, parseDir } from "@/lib/list-query";
import { BEO_STATUSES, type BeoStatus } from "./constants";
import { BeoView } from "./components/beo-view";

export const metadata = { title: "BEO — Órdenes de evento" };
export const dynamic = "force-dynamic";

/** Búsqueda insensible a acentos y mayúsculas. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default async function BeoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const estado = typeof sp.estado === "string" ? sp.estado : "";
  const range = parseDateRange(sp);
  const dir = parseDir(sp, "desc");

  // Estado y rango de fecha se filtran en la DB; la búsqueda de texto se hace en
  // memoria (insensible a acentos + substring del Nº, que es Int y no admite contains).
  const where: Prisma.BeoWhereInput = {};
  if (BEO_STATUSES.includes(estado as BeoStatus)) where.status = estado;
  const eventDate = dateTimeFilter(range);
  if (eventDate) where.eventDate = eventDate;

  const [beos, total, confirmedReservations] = await Promise.all([
    prisma.beo.findMany({
      where,
      orderBy: { number: dir },
      take: 300,
      select: {
        id: true,
        number: true,
        status: true,
        eventName: true,
        clientName: true,
        spaceName: true,
        eventDate: true,
        pax: true,
      },
    }),
    prisma.beo.count(),
    // El BEO sale de reservas de salón CONFIRMADAS sin BEO. Cubre ambos orígenes:
    // cotización ganada (la reserva trae evento + cotización) y reserva manual por
    // contacto. La dedup por evento y el descarte de eventos con BEO van más abajo.
    prisma.spaceReservation.findMany({
      where: { type: "EVENTO", status: "CONFIRMADA", beo: { is: null } },
      orderBy: { date: "desc" },
      take: 200,
      include: {
        space: { select: { name: true } },
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
          select: {
            id: true,
            name: true,
            pax: true,
            beo: { select: { id: true } },
            opportunity: {
              select: { code: true, client: { select: { brandName: true, legalName: true } } },
            },
          },
        },
        quote: {
          select: {
            number: true,
            opportunity: {
              select: { code: true, client: { select: { brandName: true, legalName: true } } },
            },
          },
        },
      },
    }),
  ]);

  const nq = norm(q);
  const beoRows = beos
    .map((b) => ({
      id: b.id,
      number: b.number,
      status: b.status,
      eventName: b.eventName ?? "—",
      clientName: b.clientName ?? "—",
      spaceName: b.spaceName,
      eventDate: b.eventDate ? b.eventDate.toISOString() : null,
      pax: b.pax,
    }))
    .filter(
      (b) =>
        !nq ||
        norm(b.eventName).includes(nq) ||
        norm(b.clientName).includes(nq) ||
        String(b.number).includes(q)
    );

  // Reservas confirmadas listas para BEO. Deduplica por evento (un evento multi-día
  // crea una reserva por día) y descarta aquellas cuyo evento ya tiene BEO.
  const seenKey = new Set<string>();
  const reservationOptions = confirmedReservations
    .filter((r) => !r.event?.beo)
    .filter((r) => {
      const key = r.eventId ?? `res:${r.id}`;
      if (seenKey.has(key)) return false;
      seenKey.add(key);
      return true;
    })
    .map((r) => {
      const client =
        r.event?.opportunity.client ??
        r.quote?.opportunity.client ??
        r.contact?.clientLinks[0]?.client ??
        null;
      return {
        id: r.id, // id de la RESERVA (el action resuelve si ata a evento o a reserva)
        name: r.event?.name ?? r.title ?? r.contact?.name ?? "Evento",
        clientName: client?.brandName ?? client?.legalName ?? r.contact?.name ?? "Sin empresa",
        spaceName: r.space.name,
        startDate: r.date.toISOString(),
        origin: r.quote?.number ?? r.event?.opportunity.code ?? "Reserva manual",
        pax: r.event?.pax ?? null,
      };
    });

  const hasFilters = Boolean(q || estado || hasDateRange(range));

  return (
    <BeoView
      beos={beoRows}
      reservationOptions={reservationOptions}
      total={total}
      filtered={beoRows.length}
      hasFilters={hasFilters}
    />
  );
}
