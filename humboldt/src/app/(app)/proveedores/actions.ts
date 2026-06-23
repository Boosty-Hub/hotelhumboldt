"use server";

// Server Actions del módulo Proveedores.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { round2 } from "@/lib/money";

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

const supplierSchema = z.object({
  id: z.string().nullish(),
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(160, "Máximo 160 caracteres"),
  serviceType: z.string().trim().max(80, "Máximo 80 caracteres").nullish(),
  contactName: z.string().trim().max(120, "Máximo 120 caracteres").nullish(),
  phone: z.string().trim().max(40, "Máximo 40 caracteres").nullish(),
  email: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Correo electrónico inválido")
    .nullish(),
  discountPct: z
    .number()
    .min(0, "El descuento no puede ser negativo")
    .max(100, "El descuento no puede superar 100%")
    .nullish(),
  appliesIva: z.boolean(),
  conditions: z.string().trim().max(4000, "Máximo 4.000 caracteres").nullish(),
  active: z.boolean(),
});

export async function saveSupplier(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada. Inicie sesión de nuevo." };

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revise los campos marcados del formulario",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const data = parsed.data;

  const payload = {
    name: data.name,
    serviceType: data.serviceType || null,
    contactName: data.contactName || null,
    phone: data.phone || null,
    email: data.email || null,
    discountPct: data.discountPct == null ? null : round2(data.discountPct),
    appliesIva: data.appliesIva,
    conditions: data.conditions || null,
    active: data.active,
  };

  try {
    if (data.id) {
      const updated = await prisma.supplier.update({
        where: { id: data.id },
        data: payload,
      });
      revalidatePath("/proveedores");
      revalidatePath(`/proveedores/${updated.id}`);
      revalidatePath("/configuracion/catalogo");
      return { ok: true, id: updated.id };
    }
    const created = await prisma.supplier.create({ data: payload });
    revalidatePath("/proveedores");
    return { ok: true, id: created.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: "Ya existe un proveedor con ese nombre",
        fieldErrors: { name: "Ya existe un proveedor con ese nombre" },
      };
    }
    return { ok: false, error: "No se pudo guardar el proveedor. Intente de nuevo." };
  }
}

export async function toggleSupplierActive(id: string, active: boolean): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada. Inicie sesión de nuevo." };
  try {
    await prisma.supplier.update({ where: { id }, data: { active } });
    revalidatePath("/proveedores");
    revalidatePath(`/proveedores/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se pudo actualizar el estado del proveedor" };
  }
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesión expirada. Inicie sesión de nuevo." };

  try {
    const [products, quoteLines, eventCosts] = await Promise.all([
      prisma.product.count({ where: { supplierId: id } }),
      prisma.quoteLine.count({ where: { supplierId: id } }),
      prisma.supplierEventCost.count({ where: { supplierId: id } }),
    ]);

    if (products > 0 || quoteLines > 0 || eventCosts > 0) {
      const partes: string[] = [];
      if (products > 0) partes.push(`${products} producto(s)`);
      if (quoteLines > 0) partes.push(`${quoteLines} línea(s) de cotización`);
      if (eventCosts > 0) partes.push(`${eventCosts} costo(s) de evento`);
      return {
        ok: false,
        error: `No se puede eliminar: el proveedor tiene ${partes.join(", ")} asociado(s). Desactívelo en su lugar.`,
      };
    }

    await prisma.supplier.delete({ where: { id } });
    revalidatePath("/proveedores");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el proveedor" };
  }
}
