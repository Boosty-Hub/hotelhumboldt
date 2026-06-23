"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { RESERVATION_STATUSES, RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { utcDayRange } from "@/lib/dates";
import { checkSpaceConflicts } from "@/lib/reservations";

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
  return format(parseISO(dateKey), "dd/MM/yyyy", { locale: es });
}

/** Registra una operación en el log de actividad de la reserva. */
async function logReservation(
  user: { id: string; name?: string | null } | null | undefined,
  reservationId: string,
  action: string,
  detail?: string
): Promise<void> {
  await prisma.reservationLog.create({
    data: {
      reservationId,
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      action,
      detail: detail ?? null,
    },
  });
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

  // ── Verificación de conflictos (regla compartida con cotizaciones) ─────
  const conflicts = await checkSpaceConflicts(data.spaceId, dateKeys);

  if (conflicts.confirmed.length > 0) {
    const detail = conflicts.confirmed
      .slice(0, 4)
      .map((c) => `“${c.label}” (${fmtDay(c.dateKey)})`)
      .join(", ");
    return {
      ok: false,
      error: `${space.name} ya tiene reserva CONFIRMADA: ${detail}${conflicts.confirmed.length > 4 ? "…" : ""}. Elija otra fecha u otro salón.`,
    };
  }

  let warning: string | undefined;
  let conflictNote = "";
  if (conflicts.tentative.length > 0) {
    const detail = conflicts.tentative
      .slice(0, 4)
      .map((c) => `“${c.label}” (${fmtDay(c.dateKey)})`)
      .join(", ");
    warning = `Atención: se solapa con tentativa${conflicts.tentative.length > 1 ? "s" : ""}: ${detail}${conflicts.tentative.length > 4 ? "…" : ""}.`;
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

  for (const key of dateKeys) {
    const created = await prisma.spaceReservation.create({
      data: {
        spaceId: data.spaceId,
        eventId: eventId!,
        date: toUtcDate(key),
        startTime: data.startTime,
        endTime: data.endTime,
        status: "TENTATIVA",
        notes,
      },
    });
    await logReservation(
      session.user,
      created.id,
      "CREADA",
      `Reserva creada en ${space.name} para el ${fmtDay(key)}${
        data.startTime ? ` (${data.startTime}${data.endTime ? `–${data.endTime}` : ""})` : ""
      }.`
    );
  }

  revalidatePath("/calendario");
  revalidatePath("/configuracion/salones");
  return {
    ok: true,
    warning,
    message: `Reserva creada en ${space.name}: ${dateKeys.length} día${dateKeys.length === 1 ? "" : "s"} en estado Tentativa.`,
  };
}

const maintenanceSchema = z
  .object({
    spaceId: z.string().min(1, "Seleccione un salón."),
    title: z.string().trim().min(2, "Indique el motivo del bloqueo.").max(120),
    from: z.string().regex(DATE_RE, "Fecha de inicio inválida."),
    to: z.string().regex(DATE_RE, "Fecha de fin inválida."),
    notes: z.string().trim().max(500).nullable(),
  })
  .refine((d) => d.to >= d.from, {
    message: "La fecha de fin debe ser igual o posterior a la de inicio.",
    path: ["to"],
  });

export type CreateMaintenanceInput = z.infer<typeof maintenanceSchema>;

/** Crea un bloqueo de mantenimiento (sin evento) — una reserva CONFIRMADA por día. */
export async function createMaintenanceBlock(
  input: CreateMaintenanceInput
): Promise<CalendarActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };

  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const dateKeys = expandRange(data.from, data.to);
  if (dateKeys.length > 60) return { ok: false, error: "El rango no puede superar 60 días." };

  const space = await prisma.space.findUnique({ where: { id: data.spaceId } });
  if (!space) return { ok: false, error: "El salón seleccionado no existe." };

  // Aviso si ya hay reservas confirmadas en el rango (el bloqueo se superpone).
  const rangeStart = utcDayRange(toUtcDate(dateKeys[0])).gte;
  const rangeEnd = utcDayRange(toUtcDate(dateKeys[dateKeys.length - 1])).lt;
  const dayKeySet = new Set(dateKeys);
  const existing = (
    await prisma.spaceReservation.findMany({
      where: { spaceId: data.spaceId, date: { gte: rangeStart, lt: rangeEnd }, status: "CONFIRMADA" },
    })
  ).filter((r) => dayKeySet.has(r.date.toISOString().slice(0, 10)));
  let warning: string | undefined;
  if (existing.length > 0) {
    const detail = existing
      .slice(0, 4)
      .map((r) => fmtDay(r.date.toISOString().slice(0, 10)))
      .join(", ");
    warning = `Atención: ya hay reservas confirmadas esos días (${detail}${existing.length > 4 ? "…" : ""}). El bloqueo se superpone.`;
  }

  for (const key of dateKeys) {
    const created = await prisma.spaceReservation.create({
      data: {
        spaceId: data.spaceId,
        eventId: null,
        type: "MANTENIMIENTO",
        title: data.title,
        date: toUtcDate(key),
        status: "CONFIRMADA",
        notes: data.notes?.trim() || null,
      },
    });
    await logReservation(
      session.user,
      created.id,
      "CREADA",
      `Bloqueo de mantenimiento en ${space.name} para el ${fmtDay(key)}: ${data.title}.`
    );
  }

  revalidatePath("/calendario");
  revalidatePath("/configuracion/salones");
  return {
    ok: true,
    warning,
    message: `Bloqueo de mantenimiento creado en ${space.name}: ${dateKeys.length} día${dateKeys.length === 1 ? "" : "s"}.`,
  };
}

const updateDetailsSchema = z.object({
  id: z.string().min(1),
  spaceId: z.string().min(1, "Seleccione un salón."),
  date: z.string().regex(DATE_RE, "Fecha inválida."),
  startTime: z.string().regex(TIME_RE, "Hora de inicio inválida (HH:mm).").nullable(),
  endTime: z.string().regex(TIME_RE, "Hora de fin inválida (HH:mm).").nullable(),
  notes: z.string().trim().max(500, "Las notas no pueden exceder 500 caracteres.").nullable(),
});

export type UpdateReservationDetailsInput = z.infer<typeof updateDetailsSchema>;

/** Edita una reserva (salón, fecha, horario, notas) verificando conflictos. */
export async function updateReservationDetails(
  input: UpdateReservationDetailsInput
): Promise<CalendarActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };

  const parsed = updateDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const reservation = await prisma.spaceReservation.findUnique({
    where: { id: data.id },
    include: { space: { select: { name: true } } },
  });
  if (!reservation) return { ok: false, error: "La reserva no existe." };

  const space = await prisma.space.findUnique({ where: { id: data.spaceId } });
  if (!space) return { ok: false, error: "El salón seleccionado no existe." };
  if (!space.active) return { ok: false, error: "El salón seleccionado está inactivo." };

  // Conflictos en el nuevo salón/día, excluyendo esta misma reserva.
  const { gte, lt } = utcDayRange(toUtcDate(data.date));
  const others = await prisma.spaceReservation.findMany({
    where: {
      id: { not: data.id },
      spaceId: data.spaceId,
      date: { gte, lt },
      status: { not: "CANCELADA" },
    },
    include: { event: { select: { name: true } } },
  });

  const confirmed = others.filter((r) => r.status === "CONFIRMADA");
  if (confirmed.length > 0) {
    const detail = confirmed.slice(0, 3).map((r) => `“${r.event?.name ?? "Mantenimiento"}”`).join(", ");
    return {
      ok: false,
      error: `${space.name} ya tiene reserva CONFIRMADA ese día: ${detail}. Elija otra fecha u otro salón.`,
    };
  }

  let warning: string | undefined;
  const tentative = others.filter((r) => r.status === "TENTATIVA");
  if (tentative.length > 0) {
    const detail = tentative.slice(0, 3).map((r) => `“${r.event?.name ?? "Mantenimiento"}”`).join(", ");
    warning = `Atención: se solapa con tentativa${tentative.length > 1 ? "s" : ""}: ${detail}.`;
  }

  await prisma.spaceReservation.update({
    where: { id: data.id },
    data: {
      spaceId: data.spaceId,
      date: toUtcDate(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes?.trim() || null,
    },
  });

  const changes: string[] = [];
  if (reservation.spaceId !== data.spaceId) {
    changes.push(`Salón: ${reservation.space.name} → ${space.name}`);
  }
  const oldDateKey = reservation.date.toISOString().slice(0, 10);
  if (oldDateKey !== data.date) changes.push(`Fecha: ${fmtDay(oldDateKey)} → ${fmtDay(data.date)}`);
  if ((reservation.startTime ?? "") !== (data.startTime ?? "")) {
    changes.push(`Hora inicio: ${reservation.startTime ?? "—"} → ${data.startTime ?? "—"}`);
  }
  if ((reservation.endTime ?? "") !== (data.endTime ?? "")) {
    changes.push(`Hora fin: ${reservation.endTime ?? "—"} → ${data.endTime ?? "—"}`);
  }
  if ((reservation.notes ?? "") !== (data.notes?.trim() ?? "")) changes.push("Notas actualizadas");
  await logReservation(
    session.user,
    data.id,
    "MODIFICADA",
    changes.length ? changes.join(" · ") : "Edición sin cambios de campos"
  );

  revalidatePath("/calendario");
  revalidatePath("/configuracion/salones");
  return { ok: true, warning, message: "Reserva actualizada." };
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
        error: `No se puede confirmar: “${clash.event?.name ?? "Mantenimiento"}” ya está confirmado en ${reservation.space.name} ese día.`,
      };
    }
  }

  await prisma.spaceReservation.update({
    where: { id: reservation.id },
    data: { status: parsed.data.status },
  });

  const labels = RESERVATION_STATUS_LABELS as Record<string, string>;
  const newStatus = parsed.data.status;
  const logAction =
    newStatus === "CONFIRMADA"
      ? "CONFIRMADA"
      : newStatus === "CANCELADA"
        ? "CANCELADA"
        : "REACTIVADA";
  await logReservation(
    session.user,
    reservation.id,
    logAction,
    `Estado: ${labels[reservation.status] ?? reservation.status} → ${labels[newStatus] ?? newStatus}`
  );

  revalidatePath("/calendario");
  return { ok: true, message: "Estado de la reserva actualizado." };
}

/** Elimina una reserva del calendario (solo el día seleccionado). */
export async function deleteReservation(id: string): Promise<CalendarActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };
  if (!id) return { ok: false, error: "Reserva inválida." };

  const reservation = await prisma.spaceReservation.findUnique({
    where: { id },
    include: { space: { select: { name: true } } },
  });
  if (!reservation) return { ok: false, error: "La reserva no existe." };

  await logReservation(
    session.user,
    id,
    "ELIMINADA",
    `Reserva eliminada (${reservation.space.name}, ${fmtDay(reservation.date.toISOString().slice(0, 10))}).`
  );
  await prisma.spaceReservation.delete({ where: { id } });

  revalidatePath("/calendario");
  revalidatePath("/configuracion/salones");
  return { ok: true, message: "Reserva eliminada." };
}

export type ReservationLogEntry = {
  id: string;
  action: string;
  detail: string | null;
  userName: string | null;
  createdAt: string;
};

/** Devuelve el log de actividad de una reserva (más reciente primero). */
export async function getReservationLog(reservationId: string): Promise<ReservationLogEntry[]> {
  const session = await auth();
  if (!session?.user || !reservationId) return [];
  const logs = await prisma.reservationLog.findMany({
    where: { reservationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    detail: l.detail,
    userName: l.userName,
    createdAt: l.createdAt.toISOString(),
  }));
}
