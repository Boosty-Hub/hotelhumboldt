"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type ActionResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

const spaceSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(80, "El nombre no puede exceder 80 caracteres."),
  dailyRate: z
    .number({ message: "La tarifa por día debe ser un número." })
    .nonnegative("La tarifa por día no puede ser negativa.")
    .nullable(),
  halfDayRate: z
    .number({ message: "La tarifa de media jornada debe ser un número." })
    .nonnegative("La tarifa de media jornada no puede ser negativa.")
    .nullable(),
  capacity: z
    .number({ message: "La capacidad debe ser un número." })
    .int("La capacidad debe ser un número entero.")
    .positive("La capacidad debe ser mayor que cero.")
    .nullable(),
  capacityNotes: z.string().trim().max(300, "Las notas de capacidad no pueden exceder 300 caracteres.").nullable(),
  description: z.string().trim().max(600, "La descripción no puede exceder 600 caracteres.").nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido."),
  active: z.boolean(),
  sortOrder: z
    .number({ message: "El orden debe ser un número." })
    .int("El orden debe ser un número entero.")
    .min(0, "El orden no puede ser negativo."),
});

export type SpaceInput = z.infer<typeof spaceSchema>;

/** Crea o actualiza un salón. */
export async function saveSpace(input: SpaceInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };

  const parsed = spaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { id, ...data } = parsed.data;

  // Nombre único (el índice de Prisma también lo garantiza, pero damos un error legible)
  const existing = await prisma.space.findUnique({ where: { name: data.name } });
  if (existing && existing.id !== id) {
    return { ok: false, error: `Ya existe un salón llamado “${data.name}”.` };
  }

  try {
    if (id) {
      await prisma.space.update({
        where: { id },
        data: {
          name: data.name,
          dailyRate: data.dailyRate,
          halfDayRate: data.halfDayRate,
          capacity: data.capacity,
          capacityNotes: data.capacityNotes || null,
          description: data.description || null,
          color: data.color,
          active: data.active,
          sortOrder: data.sortOrder,
        },
      });
    } else {
      await prisma.space.create({
        data: {
          name: data.name,
          dailyRate: data.dailyRate,
          halfDayRate: data.halfDayRate,
          capacity: data.capacity,
          capacityNotes: data.capacityNotes || null,
          description: data.description || null,
          color: data.color,
          active: data.active,
          sortOrder: data.sortOrder,
        },
      });
    }
  } catch {
    return { ok: false, error: "No se pudo guardar el salón. Intente de nuevo." };
  }

  revalidatePath("/configuracion/salones");
  revalidatePath("/calendario");
  return { ok: true };
}

/** Elimina un salón (solo si no tiene reservas asociadas). */
export async function deleteSpace(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };
  if (!id) return { ok: false, error: "Salón inválido." };

  const space = await prisma.space.findUnique({
    where: { id },
    include: { _count: { select: { reservations: true } } },
  });
  if (!space) return { ok: false, error: "El salón no existe." };

  if (space._count.reservations > 0) {
    return {
      ok: false,
      error: `“${space.name}” tiene ${space._count.reservations} reserva(s) en el calendario. Desactívelo en lugar de eliminarlo.`,
    };
  }

  try {
    await prisma.space.delete({ where: { id } });
  } catch {
    return { ok: false, error: "No se pudo eliminar el salón. Intente de nuevo." };
  }

  revalidatePath("/configuracion/salones");
  revalidatePath("/calendario");
  return { ok: true };
}
