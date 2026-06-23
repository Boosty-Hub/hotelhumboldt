"use server";

// Server Actions del módulo Pipeline de ventas
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, canDeleteQuotes } from "@/lib/auth";
import { removeFromBucket } from "@/lib/storage";
import { pickerDateToUtcDay } from "@/lib/dates";
import { notifyReleaseOpportunityReservations } from "@/lib/reservations";
import {
  STAGES,
  STAGE_LABELS,
  STAGE_DEFAULT_PROBABILITY,
  LOST_REASONS,
  type Stage,
} from "@/lib/constants";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

/** Normaliza null/"" a undefined antes de validar (evita new Date(null) → 1970). */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), schema.optional());

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

// ─────────────────────── Cambio de etapa (drag & drop / pills) ───────────────────────

const moveSchema = z
  .object({
    id: z.string().min(1, "Oportunidad inválida"),
    stage: z.enum(STAGES, { message: "Etapa inválida" }),
    lostReason: optional(z.enum(LOST_REASONS, { message: "Motivo de pérdida inválido" })),
  })
  .refine((d) => d.stage !== "PERDIDO" || !!d.lostReason, {
    message: "Indica el motivo de la pérdida",
    path: ["lostReason"],
  });

export async function moveOpportunityStage(input: {
  id: string;
  stage: string;
  lostReason?: string | null;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "No autorizado" };

  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, stage, lostReason } = parsed.data;

  const opp = await prisma.opportunity.findUnique({
    where: { id },
    select: { id: true, stage: true },
  });
  if (!opp) return { ok: false, error: "La oportunidad no existe" };
  if (opp.stage === stage) return { ok: true, id };

  const fromLabel = STAGE_LABELS[opp.stage as Stage] ?? opp.stage;
  const toLabel = STAGE_LABELS[stage];
  const body =
    stage === "PERDIDO"
      ? `Etapa cambiada: ${fromLabel} → ${toLabel} · Motivo: ${lostReason}`
      : `Etapa cambiada: ${fromLabel} → ${toLabel}`;

  try {
    await prisma.$transaction([
      prisma.opportunity.update({
        where: { id },
        data: {
          stage,
          probability: STAGE_DEFAULT_PROBABILITY[stage],
          lostReason: stage === "PERDIDO" ? lostReason : null,
        },
      }),
      prisma.activity.create({
        data: {
          userId: session.user.id,
          opportunityId: id,
          type: "CAMBIO_ETAPA",
          body,
        },
      }),
    ]);
  } catch {
    return { ok: false, error: "No se pudo actualizar la etapa. Intenta de nuevo." };
  }

  if (stage === "PERDIDO") {
    // Aviso al responsable para que libere los salones reservados (no se cancelan solos).
    try {
      await notifyReleaseOpportunityReservations(id);
    } catch (err) {
      console.error("notifyReleaseOpportunityReservations", err);
    }
    revalidatePath("/calendario");
  }

  revalidatePath("/pipeline");
  return { ok: true, id };
}

// ─────────────────────── Crear oportunidad ───────────────────────

const createSchema = z
  .object({
    clientId: optional(z.string().min(1)),
    newClientName: optional(
      z.string().trim().min(3, "La razón social debe tener al menos 3 caracteres")
    ),
    title: z
      .string({ message: "El título es obligatorio" })
      .trim()
      .min(3, "El título debe tener al menos 3 caracteres")
      .max(160, "El título es demasiado largo"),
    eventType: optional(z.string().trim().min(1)),
    segment: optional(z.string().trim().min(1)),
    channel: optional(z.string().trim().min(1)),
    expectedEventDate: optional(z.coerce.date({ message: "Fecha inválida" })),
    pax: optional(
      z
        .number({ message: "Pax debe ser un número" })
        .int("Pax debe ser un número entero")
        .positive("Pax debe ser mayor que cero")
    ),
    estimatedValue: optional(
      z.number({ message: "El valor estimado debe ser un número" }).min(0, "El valor estimado no puede ser negativo")
    ),
    ownerId: z.string({ message: "Selecciona un responsable" }).min(1, "Selecciona un responsable"),
  })
  .refine((d) => d.clientId || d.newClientName, {
    message: "Selecciona un cliente o crea uno nuevo",
    path: ["clientId"],
  });

async function nextOpportunityCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OP-${year}-`;
  const last = await prisma.opportunity.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const seq = last ? parseInt(last.code.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(Number.isNaN(seq) ? 1 : seq).padStart(4, "0")}`;
}

export async function createOpportunity(input: {
  clientId?: string | null;
  newClientName?: string | null;
  title: string;
  eventType?: string | null;
  segment?: string | null;
  channel?: string | null;
  expectedEventDate?: Date | null;
  pax?: number | null;
  estimatedValue?: number | null;
  ownerId: string;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "No autorizado" };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;

  // Reintenta ante colisión del código secuencial (creaciones concurrentes)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const code = await nextOpportunityCode();
      const created = await prisma.$transaction(async (tx) => {
        let clientId = data.clientId;
        if (!clientId && data.newClientName) {
          const client = await tx.client.create({
            data: { legalName: data.newClientName },
          });
          clientId = client.id;
        }
        const opp = await tx.opportunity.create({
          data: {
            code,
            clientId: clientId!,
            ownerId: data.ownerId,
            title: data.title,
            eventType: data.eventType ?? null,
            segment: data.segment ?? null,
            channel: data.channel ?? null,
            expectedEventDate: data.expectedEventDate
              ? pickerDateToUtcDay(data.expectedEventDate)
              : null,
            pax: data.pax ?? null,
            estimatedValue: data.estimatedValue ?? 0,
            stage: "NUEVO",
            probability: STAGE_DEFAULT_PROBABILITY.NUEVO,
          },
        });
        await tx.activity.create({
          data: {
            userId: session.user.id,
            opportunityId: opp.id,
            type: "SISTEMA",
            body: `Oportunidad ${code} creada`,
          },
        });
        return opp;
      });

      revalidatePath("/pipeline");
      revalidatePath("/clientes");
      return { ok: true, id: created.id };
    } catch (err) {
      const isUniqueViolation =
        typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
      if (isUniqueViolation && attempt < 2) continue;
      return { ok: false, error: "No se pudo crear la oportunidad. Verifica los datos." };
    }
  }
  return { ok: false, error: "No se pudo generar el código de la oportunidad." };
}

// ─────────────────────── Editar detalle (probabilidad / observaciones) ───────────────────────

const updateSchema = z.object({
  id: z.string().min(1),
  probability: optional(
    z
      .number({ message: "La probabilidad debe ser un número" })
      .int()
      .min(0, "Mínimo 0%")
      .max(100, "Máximo 100%")
  ),
  observations: z
    .preprocess((v) => (v === null ? undefined : v), z.string().trim().max(4000, "Observaciones demasiado largas").optional()),
});

export async function updateOpportunityDetails(input: {
  id: string;
  probability?: number | null;
  observations?: string | null;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "No autorizado" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, probability, observations } = parsed.data;

  const data: { probability?: number; observations?: string | null } = {};
  if (probability !== undefined) data.probability = probability;
  if (input.observations !== undefined) data.observations = observations === "" || observations === undefined ? null : observations;
  if (Object.keys(data).length === 0) return { ok: true, id };

  try {
    await prisma.opportunity.update({ where: { id }, data });
  } catch {
    return { ok: false, error: "No se pudo guardar el cambio. Intenta de nuevo." };
  }

  revalidatePath("/pipeline");
  return { ok: true, id };
}

// ─────────────────────── Nota rápida (timeline) ───────────────────────

const noteSchema = z.object({
  id: z.string().min(1),
  body: z
    .string({ message: "Escribe la nota" })
    .trim()
    .min(2, "La nota es demasiado corta")
    .max(2000, "La nota es demasiado larga"),
});

export async function addOpportunityNote(input: {
  id: string;
  body: string;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "No autorizado" };

  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const opp = await prisma.opportunity.findUnique({
    where: { id: parsed.data.id },
    select: { id: true },
  });
  if (!opp) return { ok: false, error: "La oportunidad no existe" };

  try {
    await prisma.activity.create({
      data: {
        userId: session.user.id,
        opportunityId: parsed.data.id,
        type: "NOTA",
        body: parsed.data.body,
      },
    });
  } catch {
    return { ok: false, error: "No se pudo guardar la nota. Intenta de nuevo." };
  }

  revalidatePath("/pipeline");
  return { ok: true, id: parsed.data.id };
}

// ─────────────────────── Eliminar oportunidad ───────────────────────

// Borrado real (no "mandar a Perdido", que ensucia las estadísticas). Se bloquea
// si hay dinero atado (pagos/facturas). El resto cae en cascada o se limpia a mano.
export async function deleteOpportunity(opportunityId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "No autorizado" };
  if (!canDeleteQuotes(session.user.role)) {
    return { ok: false, error: "No tenés permiso para eliminar oportunidades." };
  }

  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      code: true,
      title: true,
      clientId: true,
      _count: { select: { payments: true, invoices: true } },
      attachments: { select: { path: true } },
    },
  });
  if (!opp) return { ok: false, error: "La oportunidad no existe." };

  if (opp._count.payments > 0 || opp._count.invoices > 0) {
    return {
      ok: false,
      error: "No se puede borrar: la oportunidad tiene pagos o facturas. Anulalos primero.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Reservas de salón originadas por las cotizaciones o eventos de la oportunidad
      // (las de cotización quedan en SetNull al borrar la quote; las soltamos antes).
      await tx.spaceReservation.deleteMany({
        where: { OR: [{ quote: { opportunityId } }, { event: { opportunityId } }] },
      });
      // Cotizaciones: cascada de líneas, cuotas y actividades de la quote.
      await tx.quote.deleteMany({ where: { opportunityId } });
      // La oportunidad: cascada de eventos (→ staff/beo/costos), tareas, actividades y adjuntos.
      await tx.opportunity.delete({ where: { id: opportunityId } });
      // Rastro de auditoría en la ficha del cliente (que sobrevive).
      await tx.clientNote.create({
        data: {
          clientId: opp.clientId,
          authorId: session.user.id,
          body: `Oportunidad ${opp.code} «${opp.title}» eliminada por ${session.user.name ?? "un usuario"}.`,
        },
      });
    });
  } catch (e) {
    console.error("deleteOpportunity", e);
    return { ok: false, error: "No se pudo borrar la oportunidad. Intenta de nuevo." };
  }

  // Archivos de adjuntos en el storage (best-effort, fuera de la transacción).
  for (const a of opp.attachments) {
    try {
      await removeFromBucket(a.path);
    } catch (err) {
      console.error("removeFromBucket (deleteOpportunity)", err);
    }
  }

  revalidatePath("/pipeline");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${opp.clientId}`);
  revalidatePath("/cotizaciones");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

// ─────────────────────── Editar oportunidad (campos núcleo) ───────────────────────

const editOppSchema = z.object({
  id: z.string().min(1, "Oportunidad inválida"),
  title: z
    .string({ message: "El título es obligatorio" })
    .trim()
    .min(3, "El título debe tener al menos 3 caracteres")
    .max(160, "El título es demasiado largo"),
  eventType: optional(z.string().trim().min(1)),
  segment: optional(z.string().trim().min(1)),
  channel: optional(z.string().trim().min(1)),
  expectedEventDate: optional(z.coerce.date({ message: "Fecha inválida" })),
  pax: optional(
    z.number({ message: "Pax debe ser un número" }).int("Pax debe ser entero").positive("Pax debe ser mayor que cero")
  ),
  estimatedValue: optional(
    z.number({ message: "El valor estimado debe ser un número" }).min(0, "El valor no puede ser negativo")
  ),
  roomsCount: optional(z.number().int().min(0)),
  vgCount: optional(z.number().int().min(0)),
  ownerId: z.string({ message: "Selecciona un responsable" }).min(1, "Selecciona un responsable"),
});

export async function updateOpportunity(input: {
  id: string;
  title: string;
  eventType?: string | null;
  segment?: string | null;
  channel?: string | null;
  expectedEventDate?: Date | null;
  pax?: number | null;
  estimatedValue?: number | null;
  roomsCount?: number | null;
  vgCount?: number | null;
  ownerId: string;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "No autorizado" };

  const parsed = editOppSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;

  const opp = await prisma.opportunity.findUnique({ where: { id: d.id }, select: { id: true } });
  if (!opp) return { ok: false, error: "La oportunidad no existe" };

  const owner = await prisma.user.findUnique({ where: { id: d.ownerId }, select: { id: true } });
  if (!owner) return { ok: false, error: "El responsable seleccionado no existe" };

  try {
    await prisma.opportunity.update({
      where: { id: d.id },
      data: {
        title: d.title,
        eventType: d.eventType ?? null,
        segment: d.segment ?? null,
        channel: d.channel ?? null,
        expectedEventDate: d.expectedEventDate ? pickerDateToUtcDay(d.expectedEventDate) : null,
        pax: d.pax ?? null,
        estimatedValue: d.estimatedValue ?? 0,
        roomsCount: d.roomsCount ?? 0,
        vgCount: d.vgCount ?? 0,
        ownerId: d.ownerId,
      },
    });
  } catch {
    return { ok: false, error: "No se pudo guardar la oportunidad. Intenta de nuevo." };
  }

  revalidatePath("/pipeline");
  revalidatePath("/clientes");
  revalidatePath("/");
  return { ok: true, id: d.id };
}
