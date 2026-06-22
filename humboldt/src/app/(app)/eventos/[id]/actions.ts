"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { dateKeyToUtcDate, toDayKey } from "@/lib/dates";

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  eventId: z.string().min(1),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal("")),
});

/** Confirma la fecha del evento: quita "fechas por confirmar" y fija la fecha
 *  definitiva (si se indica una). Registra la acción en el histórico. */
export async function confirmEventDate(input: {
  eventId: string;
  startDate?: string;
}): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { eventId, startDate } = parsed.data;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, opportunityId: true, name: true, startDate: true, endDate: true },
  });
  if (!event) return { ok: false, error: "El evento no existe." };

  const newStart = startDate ? dateKeyToUtcDate(startDate) : event.startDate;
  if (!newStart) return { ok: false, error: "Indicá una fecha para confirmar." };

  // Si el evento era de un día (start === end) mantené esa relación al ajustar.
  const endDate =
    event.endDate && event.startDate && +event.endDate === +event.startDate
      ? newStart
      : event.endDate;

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: { startDate: newStart, endDate, datesTentative: false, altDates: null },
    }),
    prisma.activity.create({
      data: {
        userId: session.user.id,
        opportunityId: event.opportunityId,
        type: "SISTEMA",
        body: `Fecha del evento «${event.name}» confirmada: ${toDayKey(newStart)}`,
      },
    }),
  ]);

  revalidatePath(`/eventos/${eventId}`);
  revalidatePath("/");
  revalidatePath("/calendario");
  return { ok: true };
}
