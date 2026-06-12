"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CLIENT_TYPES } from "./_lib/shared";

// ─────────────────────────── Tipos de resultado ───────────────────────────

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function zodErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function emptyToNull(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v === "" ? null : v;
}

// ─────────────────────────── Esquemas ───────────────────────────

const clientSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(2, "La razón social debe tener al menos 2 caracteres")
    .max(160, "Máximo 160 caracteres"),
  brandName: z.string().trim().max(120, "Máximo 120 caracteres").optional().default(""),
  rif: z.string().trim().max(20, "Máximo 20 caracteres").optional().default(""),
  type: z.enum(CLIENT_TYPES, { message: "Tipo de cliente inválido" }),
  address: z.string().trim().max(300, "Máximo 300 caracteres").optional().default(""),
  phone: z.string().trim().max(40, "Máximo 40 caracteres").optional().default(""),
  email: z
    .union([z.literal(""), z.email("Correo electrónico inválido")])
    .optional()
    .default(""),
  notes: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().default(""),
});

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(120, "Máximo 120 caracteres"),
  title: z.string().trim().max(120, "Máximo 120 caracteres").optional().default(""),
  phone: z.string().trim().max(40, "Máximo 40 caracteres").optional().default(""),
  email: z
    .union([z.literal(""), z.email("Correo electrónico inválido")])
    .optional()
    .default(""),
  isPrimary: z.boolean().optional().default(false),
});

const createClientSchema = clientSchema.extend({
  contact: contactSchema.omit({ isPrimary: true }).optional(),
});

const noteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(3, "La nota debe tener al menos 3 caracteres")
    .max(4000, "Máximo 4000 caracteres"),
});

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

// ─────────────────────────── Clientes ───────────────────────────

export async function createClientAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado. Inicia sesión de nuevo." };

  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos del formulario.",
      fieldErrors: zodErrors(parsed.error),
    };
  }
  const data = parsed.data;

  const client = await prisma.client.create({
    data: {
      legalName: data.legalName,
      brandName: emptyToNull(data.brandName),
      rif: emptyToNull(data.rif),
      type: data.type,
      address: emptyToNull(data.address),
      phone: emptyToNull(data.phone),
      email: emptyToNull(data.email),
      notes: emptyToNull(data.notes),
      contacts: data.contact
        ? {
            create: {
              name: data.contact.name,
              title: emptyToNull(data.contact.title),
              phone: emptyToNull(data.contact.phone),
              email: emptyToNull(data.contact.email),
              isPrimary: true,
            },
          }
        : undefined,
      activities: {
        create: {
          userId: user.id,
          type: "SISTEMA",
          body: "Cliente creado en el sistema",
        },
      },
    },
  });

  revalidatePath("/clientes");
  return { ok: true, id: client.id };
}

export async function updateClientAction(
  clientId: string,
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado. Inicia sesión de nuevo." };

  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos del formulario.",
      fieldErrors: zodErrors(parsed.error),
    };
  }
  const data = parsed.data;

  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) return { ok: false, error: "El cliente no existe." };

  await prisma.client.update({
    where: { id: clientId },
    data: {
      legalName: data.legalName,
      brandName: emptyToNull(data.brandName),
      rif: emptyToNull(data.rif),
      type: data.type,
      address: emptyToNull(data.address),
      phone: emptyToNull(data.phone),
      email: emptyToNull(data.email),
      notes: emptyToNull(data.notes),
    },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, id: clientId };
}

export async function setClientActiveAction(
  clientId: string,
  active: boolean
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado. Inicia sesión de nuevo." };

  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) return { ok: false, error: "El cliente no existe." };

  await prisma.$transaction([
    prisma.client.update({ where: { id: clientId }, data: { active } }),
    prisma.activity.create({
      data: {
        userId: user.id,
        clientId,
        type: "SISTEMA",
        body: active ? "Cliente reactivado" : "Cliente desactivado",
      },
    }),
  ]);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, id: clientId };
}

export async function deleteClientAction(clientId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado. Inicia sesión de nuevo." };

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { _count: { select: { opportunities: true } } },
  });
  if (!client) return { ok: false, error: "El cliente no existe." };

  if (client._count.opportunities > 0) {
    return {
      ok: false,
      error:
        "No se puede eliminar: el cliente tiene oportunidades asociadas. Desactívalo en su lugar.",
    };
  }

  await prisma.client.delete({ where: { id: clientId } });

  revalidatePath("/clientes");
  return { ok: true };
}

// ─────────────────────────── Contactos ───────────────────────────

export async function createContactAction(
  clientId: string,
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado. Inicia sesión de nuevo." };

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos del formulario.",
      fieldErrors: zodErrors(parsed.error),
    };
  }
  const data = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, error: "El cliente no existe." };

  await prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.contact.updateMany({
        where: { clientId },
        data: { isPrimary: false },
      });
    }
    await tx.contact.create({
      data: {
        clientId,
        name: data.name,
        title: emptyToNull(data.title),
        phone: emptyToNull(data.phone),
        email: emptyToNull(data.email),
        isPrimary: data.isPrimary,
      },
    });
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function updateContactAction(
  contactId: string,
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado. Inicia sesión de nuevo." };

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos del formulario.",
      fieldErrors: zodErrors(parsed.error),
    };
  }
  const data = parsed.data;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { ok: false, error: "El contacto no existe." };

  await prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.contact.updateMany({
        where: { clientId: contact.clientId, NOT: { id: contactId } },
        data: { isPrimary: false },
      });
    }
    await tx.contact.update({
      where: { id: contactId },
      data: {
        name: data.name,
        title: emptyToNull(data.title),
        phone: emptyToNull(data.phone),
        email: emptyToNull(data.email),
        isPrimary: data.isPrimary,
      },
    });
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${contact.clientId}`);
  return { ok: true };
}

export async function setPrimaryContactAction(contactId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado. Inicia sesión de nuevo." };

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { ok: false, error: "El contacto no existe." };

  await prisma.$transaction([
    prisma.contact.updateMany({
      where: { clientId: contact.clientId },
      data: { isPrimary: false },
    }),
    prisma.contact.update({
      where: { id: contactId },
      data: { isPrimary: true },
    }),
  ]);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${contact.clientId}`);
  return { ok: true };
}

export async function deleteContactAction(contactId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado. Inicia sesión de nuevo." };

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { ok: false, error: "El contacto no existe." };

  await prisma.contact.delete({ where: { id: contactId } });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${contact.clientId}`);
  return { ok: true };
}

// ─────────────────────────── Notas ───────────────────────────

export async function addClientNoteAction(
  clientId: string,
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "No autorizado. Inicia sesión de nuevo." };

  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa la nota.",
      fieldErrors: zodErrors(parsed.error),
    };
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, error: "El cliente no existe." };

  await prisma.clientNote.create({
    data: {
      clientId,
      authorId: user.id,
      body: parsed.data.body,
    },
  });

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
