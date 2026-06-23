"use server";

// Server Actions del módulo Catálogo: productos, historial de precios y categorías.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, canViewCosts } from "@/lib/auth";
import { PRODUCT_TYPES, UNITS } from "@/lib/constants";
import { round2 } from "@/lib/money";
import { PRICE_CONTEXTS } from "./catalog-shared";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function isUniqueError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

const norm = (v: number | null | undefined): number | null =>
  v == null ? null : round2(v);

// ─────────────────────────── Productos ───────────────────────────

const productSchema = z.object({
  id: z.string().nullish(),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(160, "Máximo 160 caracteres"),
  categoryId: z.string().nullish(),
  type: z.enum(PRODUCT_TYPES),
  unit: z.enum(UNITS),
  listPrice: z.number().min(0, "El precio no puede ser negativo").nullish(),
  cost: z.number().min(0, "El costo no puede ser negativo").nullish(),
  supplierId: z.string().nullish(),
  minPax: z.number().int("Debe ser un número entero").min(1, "Debe ser mayor que cero").nullish(),
  unitsPerPax: z.number().int("Debe ser un número entero").min(1, "Debe ser mayor que cero").nullish(),
  priceContext: z.enum(PRICE_CONTEXTS).nullish(),
  notes: z.string().trim().max(2000, "Máximo 2.000 caracteres").nullish(),
  priceChangeReason: z.string().trim().max(500, "Máximo 500 caracteres").nullish(),
});

export async function saveProduct(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada. Inicie sesión de nuevo." };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revise los campos marcados del formulario",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const data = parsed.data;
  const allowCosts = canViewCosts(session.user.role);

  if (data.type !== "COMODIN" && data.listPrice == null) {
    return {
      ok: false,
      error: "Falta el precio de lista",
      fieldErrors: {
        listPrice: "Indique el precio de lista (solo los comodines van sin precio)",
      },
    };
  }

  const listPrice = norm(data.listPrice);
  const costInput = norm(data.cost);

  try {
    // ── Crear ── (producto + primer registro de historial, atómico)
    if (!data.id) {
      const created = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name: data.name,
            categoryId: data.categoryId ?? null,
            type: data.type,
            unit: data.unit,
            listPrice,
            cost: allowCosts ? costInput : null,
            supplierId: allowCosts ? (data.supplierId ?? null) : null,
            minPax: data.minPax ?? null,
            unitsPerPax: data.unitsPerPax ?? null,
            priceContext: data.priceContext ?? null,
            notes: data.notes || null,
          },
        });
        await tx.priceHistory.create({
          data: {
            productId: product.id,
            listPrice,
            cost: allowCosts ? costInput : null,
            authorId: session.user.id,
            reason: data.priceChangeReason || "Creación del producto",
          },
        });
        return product;
      });
      revalidatePath("/configuracion/catalogo");
      revalidatePath("/proveedores");
      return { ok: true, id: created.id };
    }

    // ── Editar ──
    const existing = await prisma.product.findUnique({ where: { id: data.id } });
    if (!existing) return { ok: false, error: "El producto ya no existe" };

    const cost = allowCosts ? costInput : norm(existing.cost);
    const supplierId = allowCosts ? (data.supplierId ?? null) : existing.supplierId;

    const priceChanged = norm(existing.listPrice) !== listPrice;
    const costChanged = allowCosts && norm(existing.cost) !== cost;

    if ((priceChanged || costChanged) && !data.priceChangeReason) {
      return {
        ok: false,
        error: "Indique el motivo del cambio de precio o costo",
        fieldErrors: {
          priceChangeReason: "Obligatorio al cambiar el precio o el costo",
        },
      };
    }

    // Actualización del producto + registro de historial: atómico, para que el
    // cambio de precio nunca quede sin su rastro de auditoría (autor/motivo).
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          categoryId: data.categoryId ?? null,
          type: data.type,
          unit: data.unit,
          listPrice,
          cost,
          supplierId,
          minPax: data.minPax ?? null,
          unitsPerPax: data.unitsPerPax ?? null,
          priceContext: data.priceContext ?? null,
          notes: data.notes || null,
        },
      });
      if (priceChanged || costChanged) {
        await tx.priceHistory.create({
          data: {
            productId: existing.id,
            listPrice,
            cost,
            authorId: session.user.id,
            reason: data.priceChangeReason,
          },
        });
      }
    });

    revalidatePath("/configuracion/catalogo");
    revalidatePath(`/configuracion/catalogo/${existing.id}`);
    revalidatePath("/proveedores");
    return { ok: true, id: existing.id };
  } catch {
    return {
      ok: false,
      error: "No se pudo guardar el producto. Verifique los datos e intente de nuevo.",
    };
  }
}

export async function toggleProductActive(id: string, active: boolean): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada. Inicie sesión de nuevo." };
  try {
    await prisma.product.update({ where: { id }, data: { active } });
    revalidatePath("/configuracion/catalogo");
    revalidatePath(`/configuracion/catalogo/${id}`);
    revalidatePath("/proveedores");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se pudo actualizar el estado del producto" };
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada. Inicie sesión de nuevo." };
  try {
    const usedInQuotes = await prisma.quoteLine.count({ where: { productId: id } });
    if (usedInQuotes > 0) {
      return {
        ok: false,
        error: `No se puede eliminar: el producto aparece en ${usedInQuotes} línea(s) de cotización. Desactívelo en su lugar.`,
      };
    }
    await prisma.product.delete({ where: { id } });
    revalidatePath("/configuracion/catalogo");
    revalidatePath("/proveedores");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el producto" };
  }
}

// ─────────────────────────── Categorías ───────────────────────────

const categorySchema = z.object({
  id: z.string().nullish(),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
});

export async function saveCategory(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada. Inicie sesión de nuevo." };

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revise el nombre de la categoría",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const data = parsed.data;

  try {
    if (data.id) {
      await prisma.productCategory.update({
        where: { id: data.id },
        data: { name: data.name },
      });
      revalidatePath("/configuracion/catalogo");
      return { ok: true, id: data.id };
    }
    const max = await prisma.productCategory.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.productCategory.create({
      data: { name: data.name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    revalidatePath("/configuracion/catalogo");
    return { ok: true, id: created.id };
  } catch (e) {
    if (isUniqueError(e)) {
      return { ok: false, error: "Ya existe una categoría con ese nombre" };
    }
    return { ok: false, error: "No se pudo guardar la categoría" };
  }
}

export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada. Inicie sesión de nuevo." };

  try {
    const all = await prisma.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return { ok: false, error: "La categoría ya no existe" };

    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= all.length) return { ok: true, id };

    [all[idx], all[target]] = [all[target], all[idx]];
    await prisma.$transaction(
      all.map((c, i) =>
        prisma.productCategory.update({ where: { id: c.id }, data: { sortOrder: i } })
      )
    );
    revalidatePath("/configuracion/catalogo");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se pudo reordenar la categoría" };
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada. Inicie sesión de nuevo." };

  try {
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      return {
        ok: false,
        error: `No se puede eliminar: la categoría tiene ${count} producto(s) asociado(s).`,
      };
    }
    await prisma.productCategory.delete({ where: { id } });
    revalidatePath("/configuracion/catalogo");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar la categoría" };
  }
}
