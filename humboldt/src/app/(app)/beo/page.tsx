import { prisma } from "@/lib/prisma";
import { BeoView } from "./components/beo-view";

export const metadata = { title: "BEO — Órdenes de evento" };
export const dynamic = "force-dynamic";

export default async function BeoPage() {
  const [beos, upcoming] = await Promise.all([
    prisma.beo.findMany({
      orderBy: { number: "desc" },
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

  const beoRows = beos.map((b) => ({
    id: b.id,
    number: b.number,
    status: b.status,
    eventName: b.eventName ?? "—",
    clientName: b.clientName ?? "—",
    spaceName: b.spaceName,
    eventDate: b.eventDate ? b.eventDate.toISOString() : null,
    pax: b.pax,
  }));

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

  return <BeoView beos={beoRows} upcomingEvents={upcomingEvents} />;
}
