import Link from "next/link";
import { format } from "date-fns";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarTimeline } from "./calendar-timeline";
import type {
  CalendarSpaceDTO,
  ConflictDTO,
  EventOptionDTO,
  OpportunityOptionDTO,
  ReservationDTO,
} from "./types";
import type { ReservationStatus } from "@/lib/constants";

export const metadata = { title: "Calendario de salones — Hotel Humboldt" };
export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const rawMonth = typeof query.mes === "string" ? query.mes : undefined;
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : format(new Date(), "yyyy-MM");
  const showCancelled = query.canceladas === "1";

  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, monthNum, 1));

  const [spaces, reservations, events, opportunities] = await Promise.all([
    prisma.space.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.spaceReservation.findMany({
      where: {
        date: { gte: monthStart, lt: nextMonthStart },
        ...(showCancelled ? {} : { status: { not: "CANCELADA" } }),
      },
      orderBy: { date: "asc" },
      include: {
        event: {
          include: {
            opportunity: { include: { client: true } },
          },
        },
      },
    }),
    prisma.event.findMany({
      where: { opportunity: { stage: { not: "PERDIDO" } } },
      orderBy: { createdAt: "desc" },
      include: { opportunity: { include: { client: true } } },
    }),
    prisma.opportunity.findMany({
      where: { stage: { not: "PERDIDO" } },
      orderBy: { code: "desc" },
      include: { client: true },
    }),
  ]);

  const spaceDtos: CalendarSpaceDTO[] = spaces.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    capacity: s.capacity,
  }));

  const reservationDtos: ReservationDTO[] = reservations.map((r) => ({
    id: r.id,
    spaceId: r.spaceId,
    dateKey: r.date.toISOString().slice(0, 10),
    startTime: r.startTime,
    endTime: r.endTime,
    status: r.status as ReservationStatus,
    notes: r.notes,
    type: r.type === "MANTENIMIENTO" ? "MANTENIMIENTO" : "EVENTO",
    eventId: r.eventId,
    eventName: r.event?.name ?? r.title ?? "Mantenimiento",
    opportunityId: r.event?.opportunityId ?? null,
    opportunityCode: r.event?.opportunity.code ?? null,
    opportunityTitle: r.event?.opportunity.title ?? null,
    clientName: r.event
      ? r.event.opportunity.client.brandName || r.event.opportunity.client.legalName
      : null,
  }));

  // ── Conflictos: 2+ reservas no canceladas en el mismo salón y día ─────
  const grouped = new Map<string, ReservationDTO[]>();
  for (const r of reservationDtos) {
    if (r.status === "CANCELADA") continue; // las canceladas no generan conflicto
    const key = `${r.spaceId}|${r.dateKey}`;
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }
  const spaceById = new Map(spaceDtos.map((s) => [s.id, s]));
  const conflicts: ConflictDTO[] = [];
  for (const [key, list] of grouped) {
    if (list.length < 2) continue;
    const [spaceId, dateKey] = key.split("|");
    const space = spaceById.get(spaceId);
    if (!space) continue;
    conflicts.push({
      spaceId,
      spaceName: space.name,
      spaceColor: space.color,
      dateKey,
      eventNames: list.map((r) => r.eventName),
    });
  }
  conflicts.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.spaceName.localeCompare(b.spaceName));

  const eventOptions: EventOptionDTO[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    clientName: e.opportunity.client.brandName || e.opportunity.client.legalName,
    opportunityCode: e.opportunity.code,
  }));

  const opportunityOptions: OpportunityOptionDTO[] = opportunities.map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    clientName: o.client.brandName || o.client.legalName,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendario de salones</h1>
        <p className="text-sm text-muted-foreground">
          Disponibilidad y reservas de los espacios del hotel por día.
        </p>
      </div>

      {spaceDtos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-sky-50 text-sky-950">
              <Building2 className="size-7" />
            </div>
            <div>
              <p className="font-semibold">No hay salones activos</p>
              <p className="text-sm text-muted-foreground">
                Active o registre salones para empezar a reservar eventos en el calendario.
              </p>
            </div>
            <Button asChild>
              <Link href="/salones">Ir a Salones</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <CalendarTimeline
          month={month}
          spaces={spaceDtos}
          reservations={reservationDtos}
          conflicts={conflicts}
          events={eventOptions}
          opportunities={opportunityOptions}
          showCancelled={showCancelled}
        />
      )}
    </div>
  );
}
