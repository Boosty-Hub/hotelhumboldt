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
    prisma.event.findMany({
      // El BEO solo se genera para eventos ganados: oportunidad GANADO o con una
      // cotización aprobada/contratada.
      where: {
        beo: { is: null },
        OR: [
          { opportunity: { stage: "GANADO" } },
          { quotes: { some: { status: { in: ["APROBADA", "CONTRATADA"] } } } },
        ],
      },
      orderBy: [{ startDate: "asc" }],
      take: 60,
      include: { opportunity: { include: { client: true } } },
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

  const upcomingEvents = upcoming.map((e) => ({
    id: e.id,
    name: e.name,
    clientName: e.opportunity.client.brandName || e.opportunity.client.legalName,
    opportunityCode: e.opportunity.code,
    startDate: e.startDate ? e.startDate.toISOString() : null,
    pax: e.pax,
  }));

  return <BeoView beos={beoRows} upcomingEvents={upcomingEvents} />;
}
