"use server";

// Server actions PÚBLICAS del link de aprobación de cotizaciones.
// No requieren sesión: el token público (nanoid único por cotización) es la
// credencial. Toda mutación re-valida estado y vigencia EN EL SERVIDOR —
// nunca se confía en lo que diga el cliente.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { differenceInCalendarDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGE_DEFAULT_PROBABILITY } from "@/lib/constants";
import { quoteBaseNumber } from "@/components/quote/quote-utils";
import { promoteQuoteReservations } from "@/lib/reservations";

export type PublicActionResult = { ok: true } | { ok: false; error: string };

/** Vencida si validUntil quedó en un día calendario anterior a hoy. */
function isExpiredByDate(validUntil: Date | null): boolean {
  if (!validUntil) return false;
  return differenceInCalendarDays(validUntil, new Date()) < 0;
}

function revalidateAfterDecision(token: string, quoteId: string) {
  revalidatePath(`/cotizacion/${token}`);
  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${quoteId}`);
  revalidatePath(`/cotizaciones/${quoteId}/editar`);
  revalidatePath("/pipeline");
}

type QuoteWithOpportunity = Prisma.QuoteGetPayload<{ include: { opportunity: true } }>;

type Guard = { ok: true; quote: QuoteWithOpportunity } | { ok: false; error: string };

/** La cotización solo admite decisión del cliente si está ENVIADA y vigente. */
async function guardActionable(token: string): Promise<Guard> {
  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    include: { opportunity: true },
  });
  if (!quote || quote.status === "BORRADOR") {
    return { ok: false, error: "La cotización no está disponible." };
  }
  if (quote.status === "APROBADA" || quote.status === "CONTRATADA") {
    return {
      ok: false,
      error: "Esta cotización ya fue aprobada. Recarga la página para ver el detalle.",
    };
  }
  if (quote.status === "RECHAZADA") {
    return {
      ok: false,
      error: "Ya se registró una respuesta para esta cotización. Recarga la página.",
    };
  }
  if (quote.status === "VENCIDA" || isExpiredByDate(quote.validUntil)) {
    return {
      ok: false,
      error:
        "Esta cotización está vencida y no puede aprobarse en línea. Contacta a tu ejecutivo para recibir una versión actualizada.",
    };
  }
  // Defensa en profundidad: si existe una versión más reciente del mismo
  // presupuesto, este link quedó obsoleto y no debe aceptar decisiones.
  const base = quoteBaseNumber(quote.number);
  const newer = await prisma.quote.findFirst({
    where: {
      OR: [{ number: base }, { number: { startsWith: `${base}-V` } }],
      version: { gt: quote.version },
    },
    select: { id: true },
  });
  if (newer) {
    return {
      ok: false,
      error:
        "Existe una versión más reciente de esta cotización. Contacta a tu ejecutivo para recibir el link actualizado.",
    };
  }
  return { ok: true, quote };
}

// ─────────────────────────── Aprobar ───────────────────────────

const approveSchema = z.object({
  approverName: z
    .string()
    .trim()
    .min(3, "Indica el nombre completo de quien aprueba (mínimo 3 caracteres)")
    .max(120, "El nombre es demasiado largo"),
  note: z.string().trim().max(1000, "La nota es demasiado larga (máximo 1.000 caracteres)").optional(),
});

export async function approveQuotePublic(
  token: string,
  input: { approverName: string; note?: string }
): Promise<PublicActionResult> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const guard = await guardActionable(token);
  if (!guard.ok) return guard;
  const quote = guard.quote;

  const base = quoteBaseNumber(quote.number);
  const approverName = parsed.data.approverName;
  const note = parsed.data.note || null;
  const now = new Date();

  try {
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: "APROBADA",
          approvedByName: approverName,
          approvedAt: now,
          agreementDate: now,
        },
      }),
      prisma.activity.create({
        data: {
          userId: quote.signerId,
          opportunityId: quote.opportunityId,
          quoteId: quote.id,
          type: "SISTEMA",
          body: `El cliente aprobó la cotización ${base} v${quote.version} desde el link público — Aprobada por: ${approverName}${note ? ` · Nota: ${note}` : ""}`,
        },
      }),
    ];

    // La oportunidad pasa a Ganado (probabilidad 100) si aún no lo está
    if (quote.opportunity.stage !== "GANADO") {
      ops.push(
        prisma.opportunity.update({
          where: { id: quote.opportunityId },
          data: { stage: "GANADO", probability: STAGE_DEFAULT_PROBABILITY.GANADO },
        }),
        prisma.activity.create({
          data: {
            userId: quote.signerId,
            opportunityId: quote.opportunityId,
            type: "CAMBIO_ETAPA",
            body: `Oportunidad movida a Ganado: el cliente aprobó la cotización ${base} desde el link público`,
          },
        })
      );
    }

    // La fecha del evento deja de ser tentativa al aprobar el cliente.
    if (quote.eventId) {
      ops.push(
        prisma.event.update({
          where: { id: quote.eventId },
          data: { datesTentative: false },
        })
      );
    }

    await prisma.$transaction(ops);
  } catch (e) {
    console.error("approveQuotePublic", e);
    return { ok: false, error: "No se pudo registrar la aprobación. Intenta de nuevo." };
  }

  // Confirma las reservas de salón de la cotización (best-effort).
  try {
    await promoteQuoteReservations(quote.id);
  } catch (err) {
    console.error("promoteQuoteReservations (público)", err);
  }

  revalidateAfterDecision(token, quote.id);
  revalidatePath("/calendario");
  return { ok: true };
}

// ─────────────────────── Solicitar cambios / Rechazar ───────────────────────

const rejectSchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, "Cuéntanos qué te gustaría ajustar (mínimo 5 caracteres)")
    .max(2000, "La nota es demasiado larga (máximo 2.000 caracteres)"),
});

export async function rejectQuotePublic(
  token: string,
  input: { note: string }
): Promise<PublicActionResult> {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const guard = await guardActionable(token);
  if (!guard.ok) return guard;
  const quote = guard.quote;

  const base = quoteBaseNumber(quote.number);
  const note = parsed.data.note;

  try {
    await prisma.$transaction([
      prisma.quote.update({
        where: { id: quote.id },
        data: { status: "RECHAZADA", rejectionNote: note },
      }),
      prisma.activity.create({
        data: {
          userId: quote.signerId,
          opportunityId: quote.opportunityId,
          quoteId: quote.id,
          type: "SISTEMA",
          body: `El cliente solicitó cambios en la cotización ${base} v${quote.version} desde el link público — Nota: ${note}`,
        },
      }),
    ]);
  } catch (e) {
    console.error("rejectQuotePublic", e);
    return { ok: false, error: "No se pudo enviar tu solicitud. Intenta de nuevo." };
  }

  revalidateAfterDecision(token, quote.id);
  return { ok: true };
}
