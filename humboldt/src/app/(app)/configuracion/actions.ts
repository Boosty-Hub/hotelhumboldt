"use server";

// Server actions del módulo Configuración.
// Permisos: ADMIN edita todo; GERENTE puede editar parámetros comerciales,
// datos del hotel, catálogos y tasa de cambio — pero NO usuarios.

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { auth, canManageSettings } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveManualRate, fetchBcvRate, RATE_TAG } from "@/lib/bcv";
import { SETTINGS_TAG } from "@/lib/settings";
import { round2 } from "@/lib/money";
import { ROLES } from "@/lib/constants";
import { validatePin, hashPin } from "@/lib/pin";
import type { ActionResult, CatalogKind } from "./types";

// ─────────────────────────── Guards ───────────────────────────

async function requireSettingsAccess(): Promise<
  { ok: true; userId: string; role: string } | { ok: false; error: string }
> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (!canManageSettings(role) && role !== "GERENTE")) {
    return { ok: false, error: "No tienes permisos para modificar la configuración." };
  }
  return { ok: true, userId: session.user.id, role: session.user.role };
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || !canManageSettings(session.user.role)) {
    return { ok: false, error: "Solo un administrador puede gestionar usuarios." };
  }
  return { ok: true, userId: session.user.id };
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// ─────────────────── Parámetros comerciales (Setting) ───────────────────

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.coerce.number().min(0, "El valor no puede ser negativo."),
  enabled: z.boolean(),
});

export async function saveSettingAction(input: {
  key: string;
  value: string | number;
  enabled: boolean;
}): Promise<ActionResult> {
  const guard = await requireSettingsAccess();
  if (!guard.ok) return guard;

  const parsed = settingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { key, value, enabled } = parsed.data;
  if (key.endsWith("_pct") && value > 100) {
    return { ok: false, error: "Un porcentaje no puede ser mayor a 100%." };
  }

  const existing = await prisma.setting.findUnique({ where: { key } });
  if (!existing) return { ok: false, error: "El parámetro no existe en la configuración." };

  await prisma.setting.update({
    where: { key },
    data: { value: String(round2(value)), enabled },
  });

  updateTag(SETTINGS_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: `«${existing.label ?? key}» guardado.` };
}

// ─────────────────────── Datos del hotel / textos ───────────────────────

const HOTEL_FIELDS: Record<string, { label: string; category: string }> = {
  hotel_name: { label: "Nombre del hotel", category: "hotel" },
  hotel_rif: { label: "RIF", category: "hotel" },
  hotel_address: { label: "Dirección", category: "hotel" },
  hotel_phone: { label: "Teléfono", category: "hotel" },
  hotel_email: { label: "Correo de ventas", category: "hotel" },
  quote_greeting: { label: "Mensaje de cortesía", category: "comercial" },
  quote_legal_conditions: { label: "Condiciones legales de cotización", category: "comercial" },
};

const hotelSchema = z.object({
  hotel_name: z.string().trim().min(1, "El nombre del hotel es obligatorio."),
  hotel_rif: z.string().trim().max(40, "RIF demasiado largo.").default(""),
  hotel_address: z.string().trim().max(300, "Dirección demasiado larga.").default(""),
  hotel_phone: z.string().trim().max(40, "Teléfono demasiado largo.").default(""),
  hotel_email: z
    .string()
    .trim()
    .default("")
    .refine(
      (v) => v === "" || z.email().safeParse(v).success,
      "El correo de ventas no es válido."
    ),
  quote_greeting: z.string().trim().max(2000, "El mensaje es demasiado largo.").default(""),
  quote_legal_conditions: z.string().max(10000, "Las condiciones son demasiado largas.").default(""),
});

export async function saveHotelSettingsAction(
  input: Record<string, string>
): Promise<ActionResult> {
  const guard = await requireSettingsAccess();
  if (!guard.ok) return guard;

  const parsed = hotelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const entries = Object.entries(parsed.data) as [string, string][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: {
          key,
          value,
          type: "string",
          enabled: true,
          label: HOTEL_FIELDS[key]?.label ?? key,
          category: HOTEL_FIELDS[key]?.category ?? "hotel",
        },
      })
    )
  );

  updateTag(SETTINGS_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: "Datos del hotel guardados." };
}

// ─────────────────────────── Usuarios (solo ADMIN) ───────────────────────────

const createUserSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  email: z.email("El correo no es válido."),
  role: z.enum(ROLES, "Rol inválido."),
  password: z.string().min(8, "La contraseña inicial debe tener al menos 8 caracteres."),
});

export async function createUserAction(input: {
  name: string;
  email: string;
  role: string;
  password: string;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { name, email, role, password } = parsed.data;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name, email: email.toLowerCase(), passwordHash, role, active: true },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, error: "Ya existe un usuario con ese correo." };
    }
    return { ok: false, error: "No se pudo crear el usuario. Intenta de nuevo." };
  }

  revalidatePath("/configuracion");
  return { ok: true, message: `Usuario «${name}» creado.` };
}

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES, "Rol inválido."),
});

export async function updateUserRoleAction(input: {
  userId: string;
  role: string;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { userId, role } = parsed.data;
  if (userId === guard.userId && role !== "ADMIN") {
    return { ok: false, error: "No puedes quitarte a ti mismo el rol de administrador." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "El usuario no existe." };

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/configuracion");
  return { ok: true, message: `Rol de ${user.name} actualizado.` };
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
});

export async function resetUserPasswordAction(input: {
  userId: string;
  password: string;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) return { ok: false, error: "El usuario no existe." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  revalidatePath("/configuracion");
  return { ok: true, message: `Contraseña de ${user.name} restablecida.` };
}

const setPinSchema = z.object({
  userId: z.string().min(1),
  pin: z.string(),
});

export async function setUserPinAction(input: {
  userId: string;
  pin: string;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = setPinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { userId, pin } = parsed.data;
  const pinError = validatePin(pin);
  if (pinError) return { ok: false, error: pinError };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "El usuario no existe." };

  // No exigimos unicidad del PIN: en el login el usuario se identifica primero,
  // así que el PIN se compara solo contra su propio hash (sin ambigüedad).
  const pinHash = await hashPin(pin);
  await prisma.user.update({ where: { id: userId }, data: { pinHash } });

  revalidatePath("/configuracion");
  return { ok: true, message: `PIN de ${user.name} configurado.` };
}

export async function clearUserPinAction(input: {
  userId: string;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  if (!input.userId) return { ok: false, error: "Usuario inválido." };

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false, error: "El usuario no existe." };

  await prisma.user.update({ where: { id: input.userId }, data: { pinHash: null } });

  revalidatePath("/configuracion");
  return { ok: true, message: `PIN de ${user.name} eliminado.` };
}

export async function toggleUserActiveAction(input: {
  userId: string;
  active: boolean;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const { userId, active } = input;
  if (!userId) return { ok: false, error: "Usuario inválido." };
  if (userId === guard.userId && !active) {
    return { ok: false, error: "No puedes desactivar tu propia cuenta." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "El usuario no existe." };

  await prisma.user.update({ where: { id: userId }, data: { active: Boolean(active) } });
  revalidatePath("/configuracion");
  return {
    ok: true,
    message: active ? `${user.name} activado.` : `${user.name} desactivado.`,
  };
}

// ─────────────────────────── Catálogos ───────────────────────────

const catalogNameSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres.")
  .max(60, "El nombre es demasiado largo.");

const KIND_LABEL: Record<CatalogKind, string> = {
  eventType: "tipo de evento",
  channel: "canal de ingreso",
};

export async function createCatalogOptionAction(input: {
  kind: CatalogKind;
  name: string;
}): Promise<ActionResult> {
  const guard = await requireSettingsAccess();
  if (!guard.ok) return guard;

  const name = catalogNameSchema.safeParse(input.name);
  if (!name.success) return { ok: false, error: firstIssue(name.error) };

  try {
    if (input.kind === "eventType") {
      await prisma.eventTypeOption.create({ data: { name: name.data } });
    } else if (input.kind === "channel") {
      await prisma.channelOption.create({ data: { name: name.data } });
    } else {
      return { ok: false, error: "Catálogo inválido." };
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, error: `Ya existe un ${KIND_LABEL[input.kind]} con ese nombre.` };
    }
    return { ok: false, error: "No se pudo agregar la opción. Intenta de nuevo." };
  }

  revalidatePath("/configuracion");
  return { ok: true, message: `«${name.data}» agregado.` };
}

export async function renameCatalogOptionAction(input: {
  kind: CatalogKind;
  id: string;
  name: string;
}): Promise<ActionResult> {
  const guard = await requireSettingsAccess();
  if (!guard.ok) return guard;

  const name = catalogNameSchema.safeParse(input.name);
  if (!name.success) return { ok: false, error: firstIssue(name.error) };
  if (!input.id) return { ok: false, error: "Opción inválida." };

  try {
    if (input.kind === "eventType") {
      await prisma.eventTypeOption.update({ where: { id: input.id }, data: { name: name.data } });
    } else if (input.kind === "channel") {
      await prisma.channelOption.update({ where: { id: input.id }, data: { name: name.data } });
    } else {
      return { ok: false, error: "Catálogo inválido." };
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, error: `Ya existe un ${KIND_LABEL[input.kind]} con ese nombre.` };
    }
    return { ok: false, error: "No se pudo renombrar la opción." };
  }

  revalidatePath("/configuracion");
  return { ok: true, message: "Opción renombrada." };
}

export async function toggleCatalogOptionAction(input: {
  kind: CatalogKind;
  id: string;
  active: boolean;
}): Promise<ActionResult> {
  const guard = await requireSettingsAccess();
  if (!guard.ok) return guard;
  if (!input.id) return { ok: false, error: "Opción inválida." };

  const data = { active: Boolean(input.active) };
  try {
    if (input.kind === "eventType") {
      await prisma.eventTypeOption.update({ where: { id: input.id }, data });
    } else if (input.kind === "channel") {
      await prisma.channelOption.update({ where: { id: input.id }, data });
    } else {
      return { ok: false, error: "Catálogo inválido." };
    }
  } catch {
    return { ok: false, error: "No se pudo actualizar la opción." };
  }

  revalidatePath("/configuracion");
  return {
    ok: true,
    message: input.active ? "Opción activada." : "Opción desactivada.",
  };
}

// ─────────────────────────── Tasa de cambio ───────────────────────────

/** Fuerza la consulta a la API del BCV y registra la tasa del día. */
export async function refreshBcvRateAction(): Promise<ActionResult> {
  const guard = await requireSettingsAccess();
  if (!guard.ok) return guard;

  const rate = await fetchBcvRate({ force: true });
  if (rate == null) {
    return {
      ok: false,
      error:
        "No se pudo consultar la tasa del BCV. Verifica la conexión o registra una tasa manual.",
    };
  }
  await prisma.exchangeRate.create({
    data: { date: new Date(), rate, source: "BCV", kind: "OFICIAL" },
  });
  updateTag(RATE_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: `Tasa BCV actualizada: Bs. ${rate} por USD.` };
}

const manualRateSchema = z.coerce
  .number()
  .positive("La tasa debe ser un número mayor que cero.")
  .max(1_000_000, "La tasa parece incorrecta.");

export async function setManualRateAction(input: {
  rate: string | number;
}): Promise<ActionResult> {
  const guard = await requireSettingsAccess();
  if (!guard.ok) return guard;

  const parsed = manualRateSchema.safeParse(input.rate);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  await saveManualRate(parsed.data);
  updateTag(RATE_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: `Tasa manual registrada: Bs. ${round2(parsed.data)} por USD.` };
}

/** Registra la tasa PARALELA (siempre manual). */
export async function setParallelRateAction(input: {
  rate: string | number;
}): Promise<ActionResult> {
  const guard = await requireSettingsAccess();
  if (!guard.ok) return guard;

  const parsed = manualRateSchema.safeParse(input.rate);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  await saveManualRate(parsed.data, "PARALELA");
  updateTag(RATE_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: `Tasa paralela registrada: Bs. ${round2(parsed.data)} por USD.` };
}
