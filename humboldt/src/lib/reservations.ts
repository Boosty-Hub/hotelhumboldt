// Lógica de dominio compartida de reservas de salón.
//
// Reutilizada por el calendario (createReservation) y —en la Etapa 2— por el
// flujo de cotización, para no duplicar la regla de conflictos. Regla:
//   CONFIRMADA → bloquea   |   TENTATIVA → solo advierte   |   CANCELADA → se ignora.
// La comparación es por DÍA UTC (convención canónica del sistema, ver dates.ts):
// robusta ante reservas con cualquier hora.

import { prisma } from "./prisma";
import { utcDayRange, dateKeyToUtcDate, toDayKey } from "./dates";

export interface SpaceConflict {
  reservationId: string;
  status: string; // CONFIRMADA | TENTATIVA
  label: string; // nombre del evento o título del bloqueo
  dateKey: string; // yyyy-MM-dd
}

export interface SpaceConflictResult {
  confirmed: SpaceConflict[]; // bloquean la reserva (regla dura)
  tentative: SpaceConflict[]; // coexisten, solo advierten
}

/**
 * Detecta solapes de un salón en un conjunto de días (claves yyyy-MM-dd).
 * Ignora CANCELADA y, opcionalmente, una reserva concreta (ediciones) o todo un
 * evento (para no chocar contra las reservas del propio evento al re-sincronizar).
 */
export async function checkSpaceConflicts(
  spaceId: string,
  dateKeys: string[],
  opts?: { excludeReservationId?: string; excludeEventId?: string }
): Promise<SpaceConflictResult> {
  if (dateKeys.length === 0) return { confirmed: [], tentative: [] };

  const sorted = [...dateKeys].sort();
  const rangeStart = utcDayRange(dateKeyToUtcDate(sorted[0])).gte;
  const rangeEnd = utcDayRange(dateKeyToUtcDate(sorted[sorted.length - 1])).lt;
  const dayKeySet = new Set(sorted);

  const rows = await prisma.spaceReservation.findMany({
    where: {
      spaceId,
      date: { gte: rangeStart, lt: rangeEnd },
      status: { not: "CANCELADA" },
      ...(opts?.excludeReservationId ? { id: { not: opts.excludeReservationId } } : {}),
      // Excluir SOLO las reservas del mismo evento. Ojo: `{ not: X }` en Prisma
      // descarta también las filas con eventId NULL (bloqueos de mantenimiento),
      // por eso usamos OR para conservarlas.
      ...(opts?.excludeEventId
        ? { OR: [{ eventId: null }, { eventId: { not: opts.excludeEventId } }] }
        : {}),
    },
    include: { event: { select: { name: true } } },
  });

  const hits: SpaceConflict[] = rows
    .filter((r) => dayKeySet.has(toDayKey(r.date)))
    .map((r) => ({
      reservationId: r.id,
      status: r.status,
      label: r.event?.name ?? r.title ?? "Reserva",
      dateKey: toDayKey(r.date),
    }));

  return {
    confirmed: hits.filter((h) => h.status === "CONFIRMADA"),
    tentative: hits.filter((h) => h.status === "TENTATIVA"),
  };
}

// ───────────────── Reservar salones desde una cotización ─────────────────

/** Claves yyyy-MM-dd entre dos fechas UTC (inclusive). */
function dayKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor.getTime() <= last.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export interface ReserveResult {
  created: number;
  reservedSpaces: string[];
  blocked: { space: string; reason: string }[];
  warnings: string[];
}

/**
 * Crea reservas TENTATIVA de los salones indicados para las fechas del evento
 * de la cotización. Reglas:
 *  - Si un salón ya tiene CONFIRMADA en esas fechas → NO se reserva (queda en
 *    `blocked`), pero NO bloquea la creación de la cotización.
 *  - Si solo hay tentativas de otros → se reserva igual y se avisa.
 *  - Deduplica por (spaceId, eventId, date) y vincula cada reserva al quoteId.
 * Registra log y actividad. Pensada para llamarse al crear la cotización.
 */
export async function reserveQuoteSpaces(
  quoteId: string,
  spaceIds: string[],
  user?: { id: string; name?: string | null } | null
): Promise<ReserveResult> {
  const result: ReserveResult = { created: 0, reservedSpaces: [], blocked: [], warnings: [] };
  if (spaceIds.length === 0) return result;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { event: true },
  });
  if (!quote?.event?.startDate) return result; // sin fechas no hay reserva

  const event = quote.event;
  const startDate = event.startDate!; // garantizado por el guard de arriba
  const dateKeys = dayKeysBetween(startDate, event.endDate ?? startDate);
  if (dateKeys.length === 0) return result;

  const spaces = await prisma.space.findMany({
    where: { id: { in: spaceIds }, active: true },
  });
  const label = quote.number.replace(/-V\d+$/, ""); // número base de la cotización

  for (const space of spaces) {
    const conflicts = await checkSpaceConflicts(space.id, dateKeys, { excludeEventId: event.id });
    if (conflicts.confirmed.length > 0) {
      result.blocked.push({ space: space.name, reason: "ya tiene una reserva confirmada" });
      continue; // no reservar este salón
    }
    const note = conflicts.tentative.length > 0 ? "[Conflicto al cotizar] Solapa con otra tentativa." : "";
    if (note) result.warnings.push(`${space.name}: se solapa con otra reserva tentativa.`);

    let createdForSpace = 0;
    for (const key of dateKeys) {
      const date = dateKeyToUtcDate(key);
      const dup = await prisma.spaceReservation.findFirst({
        where: { spaceId: space.id, eventId: event.id, date },
      });
      if (dup) continue;
      const reservation = await prisma.spaceReservation.create({
        data: {
          spaceId: space.id,
          eventId: event.id,
          quoteId,
          date,
          startTime: event.startTime,
          endTime: event.endTime,
          status: "TENTATIVA",
          notes: [`Tentativa desde la cotización ${label}`, note].filter(Boolean).join(" "),
        },
      });
      await prisma.reservationLog.create({
        data: {
          reservationId: reservation.id,
          userId: user?.id ?? null,
          userName: user?.name ?? null,
          action: "CREADA",
          detail: `Reserva tentativa desde la cotización ${label} (${space.name})`,
        },
      });
      createdForSpace++;
    }
    if (createdForSpace > 0) {
      result.created += createdForSpace;
      result.reservedSpaces.push(space.name);
    }
  }

  if (result.reservedSpaces.length > 0) {
    await prisma.activity.create({
      data: {
        userId: user?.id ?? quote.signerId,
        opportunityId: quote.opportunityId,
        quoteId,
        type: "SISTEMA",
        body: `Reservas tentativas de salón creadas: ${result.reservedSpaces.join(", ")}`,
      },
    });
  }
  return result;
}

type ActorUser = { id: string; name?: string | null } | null | undefined;

async function logReservation(
  reservationId: string,
  user: ActorUser,
  action: string,
  detail: string
): Promise<void> {
  await prisma.reservationLog.create({
    data: {
      reservationId,
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      action,
      detail,
    },
  });
}

export interface PromoteResult {
  confirmed: number;
  created: number;
  blocked: string[];
}

/**
 * Al CONTRATAR: promueve a CONFIRMADA las reservas de la cotización (las
 * tentativas hechas al cotizar + las que correspondan a las líneas de ESPACIOS,
 * resueltas por Product.spaceId). Respeta la exclusividad: si otro evento ya
 * tiene CONFIRMADA ese salón/día, no pisa (lo deja en `blocked`).
 */
export async function promoteQuoteReservations(
  quoteId: string,
  user?: ActorUser
): Promise<PromoteResult> {
  const result: PromoteResult = { confirmed: 0, created: 0, blocked: [] };
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      event: true,
      lines: { include: { product: { select: { spaceId: true } } } },
      reservations: { select: { spaceId: true } },
    },
  });
  if (!quote?.event?.startDate) return result;

  const event = quote.event;
  const startDate = event.startDate!;
  const dateKeys = dayKeysBetween(startDate, event.endDate ?? startDate);
  const label = quote.number.replace(/-V\d+$/, "");

  const fromLines = quote.lines
    .filter((l) => l.section === "ESPACIOS" && !l.isOptional && l.product?.spaceId)
    .map((l) => l.product!.spaceId!);
  const fromReservations = quote.reservations.map((r) => r.spaceId);
  const spaceIds = [...new Set([...fromLines, ...fromReservations])];
  if (spaceIds.length === 0) return result;

  const spaces = await prisma.space.findMany({
    where: { id: { in: spaceIds } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(spaces.map((s) => [s.id, s.name]));

  for (const spaceId of spaceIds) {
    for (const key of dateKeys) {
      const date = dateKeyToUtcDate(key);
      // Exclusividad: ¿otra reserva CONFIRMADA de OTRO evento en ese salón/día?
      const conflict = await checkSpaceConflicts(spaceId, [key], { excludeEventId: event.id });
      if (conflict.confirmed.length > 0) {
        const nm = nameOf.get(spaceId) ?? spaceId;
        if (!result.blocked.includes(nm)) result.blocked.push(nm);
        continue;
      }
      const existing = await prisma.spaceReservation.findFirst({
        where: { spaceId, eventId: event.id, date },
      });
      if (existing) {
        if (existing.status !== "CONFIRMADA") {
          await prisma.spaceReservation.update({
            where: { id: existing.id },
            data: { status: "CONFIRMADA", quoteId },
          });
          await logReservation(existing.id, user, "CONFIRMADA", `Confirmada al contratar la cotización ${label}`);
          result.confirmed++;
        }
      } else {
        const created = await prisma.spaceReservation.create({
          data: {
            spaceId,
            eventId: event.id,
            quoteId,
            date,
            startTime: event.startTime,
            endTime: event.endTime,
            status: "CONFIRMADA",
            notes: `Confirmada al contratar la cotización ${label}`,
          },
        });
        await logReservation(created.id, user, "CREADA", `Confirmada al contratar la cotización ${label} (${nameOf.get(spaceId)})`);
        result.created++;
      }
    }
  }

  if (result.confirmed + result.created > 0) {
    await prisma.activity.create({
      data: {
        userId: user?.id ?? quote.signerId,
        opportunityId: quote.opportunityId,
        quoteId,
        type: "SISTEMA",
        body: `Reservas de salón confirmadas al contratar (${result.confirmed + result.created} día/s).`,
      },
    });
  }
  return result;
}

// ───────── Notificación para liberar salón (cotización rechazada / oportunidad perdida) ─────────

/** Crea una tarea para que el ejecutivo decida liberar el/los salón(es) de una cotización. */
export async function notifyReleaseQuoteReservations(
  quoteId: string,
  reason: string
): Promise<void> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      reservations: {
        where: { status: { in: ["TENTATIVA", "CONFIRMADA"] } },
        include: { space: { select: { name: true } } },
      },
    },
  });
  if (!quote || quote.reservations.length === 0) return;

  const salones = [...new Set(quote.reservations.map((r) => r.space.name))];
  const label = quote.number.replace(/-V\d+$/, "");
  await prisma.task.create({
    data: {
      opportunityId: quote.opportunityId,
      assigneeId: quote.signerId,
      type: "OTRO",
      title: `Liberar salón reservado — ${reason}`,
      notes: `La cotización ${label} (${reason}) tiene ${quote.reservations.length} reserva(s) de salón activa(s): ${salones.join(", ")}. Revisá el calendario y cancelá las que ya no apliquen para liberar el espacio.`,
      dueAt: new Date(),
      status: "PENDIENTE",
    },
  });
}

/** Crea una tarea para liberar los salones de TODAS las cotizaciones de una oportunidad perdida. */
export async function notifyReleaseOpportunityReservations(opportunityId: string): Promise<void> {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      ownerId: true,
      events: {
        select: {
          reservations: {
            where: { status: { in: ["TENTATIVA", "CONFIRMADA"] } },
            include: { space: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!opp) return;
  const reservations = opp.events.flatMap((e) => e.reservations);
  if (reservations.length === 0) return;

  const salones = [...new Set(reservations.map((r) => r.space.name))];
  await prisma.task.create({
    data: {
      opportunityId,
      assigneeId: opp.ownerId,
      type: "OTRO",
      title: "Liberar salón reservado — oportunidad perdida",
      notes: `Esta oportunidad se marcó como PERDIDA pero tiene ${reservations.length} reserva(s) de salón activa(s): ${salones.join(", ")}. Revisá el calendario y cancelá las que ya no apliquen.`,
      dueAt: new Date(),
      status: "PENDIENTE",
    },
  });
}
