"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TASK_TYPES, RECURRENCES } from "@/lib/constants";

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function requireUser() {
  const session = await auth();
  return session?.user ?? null;
}

function firstIssue(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Datos inválidos.";
}

/** Próxima fecha según la recurrencia, a partir de la fecha dada. */
function nextDue(from: Date, recurrence: string): Date {
  const d = new Date(from);
  switch (recurrence) {
    case "DIARIA":
      d.setDate(d.getDate() + 1);
      break;
    case "SEMANAL":
      d.setDate(d.getDate() + 7);
      break;
    case "QUINCENAL":
      d.setDate(d.getDate() + 15);
      break;
    case "MENSUAL":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

const createSchema = z.object({
  opportunityId: z.string().min(1, "Oportunidad inválida."),
  type: z.enum(TASK_TYPES, "Tipo de tarea inválido."),
  title: z.string().trim().min(2, "El título debe tener al menos 2 caracteres."),
  notes: z.string().trim().max(500).optional(),
  dueAt: z.string().min(1, "Falta la fecha de la tarea."),
  recurrence: z.enum(RECURRENCES).default("NONE"),
});

export async function createTask(input: {
  opportunityId: string;
  type: string;
  title: string;
  notes?: string;
  dueAt: string;
  recurrence?: string;
}): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado." };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { opportunityId, type, title, notes, dueAt, recurrence } = parsed.data;

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { ok: false, error: "Fecha inválida." };

  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { ownerId: true },
  });
  if (!opp) return { ok: false, error: "Oportunidad no encontrada." };

  const task = await prisma.$transaction(async (tx) => {
    const t = await tx.task.create({
      data: {
        opportunityId,
        type,
        title,
        notes: notes || null,
        dueAt: due,
        recurrence,
        assigneeId: opp.ownerId,
        creatorId: user.id,
      },
    });
    await tx.activity.create({
      data: {
        userId: user.id,
        opportunityId,
        type: "SISTEMA",
        body: `Tarea programada: ${title}`,
      },
    });
    return t;
  });

  revalidatePath("/pipeline");
  return { ok: true, id: task.id };
}

export async function completeTask(input: { id: string }): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!input.id) return { ok: false, error: "Tarea inválida." };

  const task = await prisma.task.findUnique({ where: { id: input.id } });
  if (!task) return { ok: false, error: "Tarea no encontrada." };
  if (task.status === "COMPLETADA") return { ok: true, id: task.id };

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: { status: "COMPLETADA", completedAt: new Date() },
    });
    // Recurrencia: agenda automáticamente la próxima ocurrencia.
    if (task.recurrence && task.recurrence !== "NONE") {
      await tx.task.create({
        data: {
          opportunityId: task.opportunityId,
          type: task.type,
          title: task.title,
          notes: task.notes,
          dueAt: nextDue(task.dueAt, task.recurrence),
          recurrence: task.recurrence,
          assigneeId: task.assigneeId,
          creatorId: task.creatorId,
        },
      });
    }
    await tx.activity.create({
      data: {
        userId: user.id,
        opportunityId: task.opportunityId,
        type: "SISTEMA",
        body: `Tarea completada: ${task.title}`,
      },
    });
  });

  revalidatePath("/pipeline");
  return { ok: true };
}

const snoozeSchema = z.object({
  id: z.string().min(1),
  dueAt: z.string().min(1, "Falta la nueva fecha."),
});

export async function snoozeTask(input: { id: string; dueAt: string }): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado." };

  const parsed = snoozeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const due = new Date(parsed.data.dueAt);
  if (Number.isNaN(due.getTime())) return { ok: false, error: "Fecha inválida." };

  await prisma.task.update({
    where: { id: parsed.data.id },
    data: { dueAt: due, status: "PENDIENTE" },
  });

  revalidatePath("/pipeline");
  return { ok: true };
}

export async function cancelTask(input: { id: string }): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado." };
  if (!input.id) return { ok: false, error: "Tarea inválida." };

  await prisma.task.update({
    where: { id: input.id },
    data: { status: "CANCELADA" },
  });

  revalidatePath("/pipeline");
  return { ok: true };
}
