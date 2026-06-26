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

  const [beos, total, upcoming] = await Promise.all([
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
    // El BEO solo sale de oportunidades con una cotización GANADA/APROBADA
    // que aún no tienen BEO (ninguno de sus eventos tiene BEO).
    prisma.opportunity.findMany({
      where: {
        quotes: { some: { status: { in: ["APROBADA", "CONTRATADA"] } } },
        events: { none: { beo: { isNot: null } } },
      },
      orderBy: [{ expectedEventDate: "asc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        client: true,
        // La cotización ganada/aprobada aporta el número y, vía su evento, la fecha real.
        quotes: {
          where: { status: { in: ["APROBADA", "CONTRATADA"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            number: true,
            event: { select: { startDate: true, name: true, pax: true } },
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

  const upcomingEvents = upcoming.map((o) => {
    const wonQuote = o.quotes[0];
    const ev = wonQuote?.event ?? null;
    // La fecha real es la del evento de la cotización ganada; la oportunidad es el respaldo.
    const startDate = ev?.startDate ?? o.expectedEventDate;
    return {
      id: o.id, // id de la OPORTUNIDAD (el BEO crea el evento si falta)
      name: ev?.name || o.title,
      clientName: o.client.brandName || o.client.legalName,
      opportunityCode: wonQuote?.number ?? o.code,
      startDate: startDate ? startDate.toISOString() : null,
      pax: ev?.pax ?? o.pax,
    };
  });

  const hasFilters = Boolean(q || estado || hasDateRange(range));

  return (
    <BeoView
      beos={beoRows}
      upcomingEvents={upcomingEvents}
      total={total}
      filtered={beoRows.length}
      hasFilters={hasFilters}
    />
  );
}
