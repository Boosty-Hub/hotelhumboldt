"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { RESERVATION_STATUSES } from "@/lib/constants";
import { utcDayRange } from "@/lib/dates";

export type CalendarActionResult =
  | { ok: true; warning?: string; message?: string }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Convierte una clave yyyy-MM-dd a Date UTC medianoche (formato canónico en BD). */
function toUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Lista de claves yyyy-MM-dd entre dos fechas (inclusive). */
function expandRange(from: string, to: string): string[] {
  const keys: string[] = [];
  const cursor = toUtcDate(from);
  const end = toUtcDate(to);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function fmtDay(dateKey: string): string {
  return format(parseISO(dateKey), "d 'de' MMM yyyy", { locale: es });
}

const createSchema = z
  .object({
    spaceId: z.string().min(1, "Seleccione un salón."),
    eventId: z.string().nullable(),
    newEventName: z.string().trim().max(120, "El nombre del evento no puede exceder 120 caracteres.").nullable(),
    opportunityId: z.string().nullable(),
    from: z.string().regex(DATE_RE, "Fecha de inicio inválida."),
    to: z.string().regex(DATE_RE, "Fecha de fin inválida."),
    startTime: z.string().regex(TIME_RE, "Hora de inicio inválida (HH:mm).").nullable(),
    endTime: z.string().regex(TIME_RE, "Hora de fin inválida (HH:mm).").nullable(),
    notes: z.string().trim().max(500, "Las notas no pueden exceder 500 caracteres.").nullable(),
  })
  .refine((d) => d.to >= d.from, {
    message: "La fecha de fin debe ser igual o posterior a la de inicio.",
    path: ["to"],
  })
  .refine((d) => Boolean(d.eventId) || (Boolean(d.newEventName?.trim()) && Boolean(d.opportunityId)), {
    message: "Seleccione un evento existente o indique nombre y oportunidad para el evento nuevo.",
    path: ["eventId"],
  });

export type CreateReservationInput = z.infer<typeof createSchema>;

/**
 * Crea reservas de salón (una por día del rango).
 * - Si choca con una reserva CONFIRMADA → error y no crea nada.
 * - Si choca con una TENTATIVA → crea igual, lo registra en notas y devuelve warning.
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<CalendarActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const dateKeys = expandRange(data.from, data.to);
  if (dateKeys.length > 31) {
    return { ok: false, error: "El rango no puede superar 31 días." };
  }

  const space = await prisma.space.findUnique({ where: { id: data.spaceId } });
  if (!space) return { ok: false, error: "El salón seleccionado no existe." };
  if (!space.active) return { ok: false, error: "El salón seleccionado está inactivo." };

  // ── Verificación de conflictos ────────────────────────────────────────
  // Por rango de día UTC (robusto ante reservas con cualquier hora del día).
  const rangeStart = utcDayRange(toUtcDate(dateKeys[0])).gte;
  const rangeEnd = utcDayRange(toUtcDate(dateKeys[dateKeys.length - 1])).lt;
  const dayKeySet = new Set(dateKeys);
  const existing = (
    await prisma.spaceReservation.findMany({
      where: {
        spaceId: data.spaceId,
        date: { gte: rangeStart, lt: rangeEnd },
        status: { not: "CANCELADA" },
      },
      include: { event: { select: { id: true, name: true } } },
    })
  ).filter((r) => dayKeySet.has(r.date.toISOString().slice(0, 10)));

  const confirmed = existing.filter((r) => r.status === "CONFIRMADA");
  if (confirmed.length > 0) {
    const detail = confirmed
      .slice(0, 4)
      .map((r) => `“${r.event.name}” (${fmtDay(r.date.toISOString().slice(0, 10))})`)
      .join(", ");
    return {
      ok: false,
      error: `${space.name} ya tiene reserva CONFIRMADA: ${detail}${confirmed.length > 4 ? "…" : ""}. Elija otra fecha u otro salón.`,
    };
  }

  const tentative = existing.filter((r) => r.status === "TENTATIVA");
  let warning: string | undefined;
  let conflictNote = "";
  if (tentative.length > 0) {
    const detail = tentative
      .slice(0, 4)
      .map((r) => `“${r.event.name}” (${fmtDay(r.date.toISOString().slice(0, 10))})`)
      .join(", ");
    warning = `Atención: se solapa con tentativa${tentative.length > 1 ? "s" : ""}: ${detail}${tentative.length > 4 ? "…" : ""}.`;
    conflictNote = `[Conflicto al crear] Solapa con tentativa: ${detail}.`;
  }

  // ── Evento: existente o creación rápida ───────────────────────────────
  let eventId = data.eventId;
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return { ok: false, error: "El evento seleccionado no existe." };
  } else {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: data.opportunityId! },
    });
    if (!opportunity) return { ok: false, error: "La oportunidad seleccionada no existe." };
    const event = await prisma.event.create({
      data: {
        opportunityId: opportunity.id,
        name: data.newEventName!.trim(),
        startDate: toUtcDate(dateKeys[0]),
        endDate: toUtcDate(dateKeys[dateKeys.length - 1]),
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });
    eventId = event.id;
  }

  const userNotes = data.notes?.trim() || "";
  const notes = [userNotes, conflictNote].filter(Boolean).join(" ") || null;

  await prisma.spaceReservation.createMany({
    data: dateKeys.map((key) => ({
      spaceId: data.spaceId,
      eventId: eventId!,
      date: toUtcDate(key),
      startTime: data.startTime,
      endTime: data.endTime,
      status: "TENTATIVA",
      notes,
    })),
  });

  revalidatePath("/calendario");
  revalidatePath("/salones");
  return {
    ok: true,
    warning,
    message: `Reserva creada en ${space.name}: ${dateKeys.length} día${dateKeys.length === 1 ? "" : "s"} en estado Tentativa.`,
  };
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(RESERVATION_STATUSES),
});

/** Cambia el estado de una reserva (TENTATIVA → CONFIRMADA → CANCELADA). */
export async function updateReservationStatus(
  id: string,
  status: string
): Promise<CalendarActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };

  const parsed = statusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Estado inválido." };

  const reservation = await prisma.spaceReservation.findUnique({
    where: { id: parsed.data.id },
    include: { space: true, event: { select: { name: true } } },
  });
  if (!reservation) return { ok: false, error: "La reserva no existe." };

  // Al confirmar, no puede chocar con otra CONFIRMADA en el mismo salón y día
  // (comparación por rango de día UTC, no por igualdad exacta de timestamp).
  if (parsed.data.status === "CONFIRMADA") {
    const { gte, lt } = utcDayRange(reservation.date);
    const clash = await prisma.spaceReservation.findFirst({
      where: {
        id: { not: reservation.id },
        spaceId: reservation.spaceId,
        date: { gte, lt },
        status: "CONFIRMADA",
      },
      include: { event: { select: { name: true } } },
    });
    if (clash) {
      return {
        ok: false,
        error: `No se puede confirmar: “${clash.event.name}” ya está confirmado en ${reservation.space.name} ese día.`,
      };
    }
  }

  await prisma.spaceReservation.update({
    where: { id: reservation.id },
    data: { status: parsed.data.status },
  });

  revalidatePath("/calendario");
  return { ok: true, message: "Estado de la reserva actualizado." };
}

/** Elimina una reserva del calendario (solo el día seleccionado). */
export async function deleteReservation(id: string): Promise<CalendarActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };
  if (!id) return { ok: false, error: "Reserva inválida." };

  const reservation = await prisma.spaceReservation.findUnique({ where: { id } });
  if (!reservation) return { ok: false, error: "La reserva no existe." };

  await prisma.spaceReservation.delete({ where: { id } });

  revalidatePath("/calendario");
  revalidatePath("/salones");
  return { ok: true, message: "Reserva eliminada." };
}
