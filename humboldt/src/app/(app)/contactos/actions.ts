"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CLIENT_TYPES } from "../clientes/_lib/shared";

type Result =
  | { ok: true; contactId: string; clientId: string | null }
  | { ok: false; error: string };

// El cliente es OPCIONAL: un contacto puede crearse libre (sin empresa),
// vincularse a una existente, o a una nueva (walk-in).
const schema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(120),
  title: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.literal(""), z.email("Correo electrónico inválido.")]).optional(),
  rif: z.string().trim().max(20).optional(),
  referredBy: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  // Cliente: ninguno (libre), existente (clientId) o nuevo (newClientName + tipo)
  clientId: z.string().trim().optional(),
  newClientName: z.string().trim().max(160).optional(),
  newClientType: z.enum(CLIENT_TYPES).optional(),
});

function nn(s?: string): string | null {
  const v = (s ?? "").trim();
  return v === "" ? null : v;
}

/**
 * Crea un contacto. El cliente es opcional: sin cliente (libre), con uno
 * existente (se vincula vía ClientContact), o con uno nuevo (walk-in).
 */
export async function createWalkInContactAction(input: {
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  rif?: string;
  referredBy?: string;
  notes?: string;
  clientId?: string;
  newClientName?: string;
  newClientType?: string;
}): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "No autorizado. Iniciá sesión de nuevo." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;
  const wantsNewClient = (d.newClientName?.trim().length ?? 0) >= 2;

  if (d.clientId) {
    const exists = await prisma.client.findUnique({
      where: { id: d.clientId },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "El cliente seleccionado no existe." };
  }

  const res = await prisma.$transaction(async (tx) => {
    let clientId = d.clientId || null;
    if (!clientId && wantsNewClient) {
      const client = await tx.client.create({
        data: {
          legalName: d.newClientName!.trim(),
          type: d.newClientType ?? "PERSONA",
          rif: nn(d.rif),
        },
      });
      clientId = client.id;
    } else if (clientId && nn(d.rif)) {
      // Completa el RIF del cliente existente solo si todavía no tiene uno (no pisa).
      const existing = await tx.client.findUnique({
        where: { id: clientId },
        select: { rif: true },
      });
      if (existing && !existing.rif) {
        await tx.client.update({ where: { id: clientId }, data: { rif: nn(d.rif) } });
      }
    }

    const contact = await tx.contact.create({
      data: {
        name: d.name,
        title: nn(d.title),
        phone: nn(d.phone),
        email: nn(d.email),
      },
      select: { id: true },
    });

    // Si hay cliente, se vincula (primario si es el primer contacto del cliente).
    if (clientId) {
      const count = await tx.clientContact.count({ where: { clientId } });
      await tx.clientContact.create({
        data: { clientId, contactId: contact.id, isPrimary: count === 0 },
      });

      // Notas + referido => nota en el timeline del cliente.
      const noteParts: string[] = [];
      if (nn(d.referredBy)) noteParts.push(`Referido por: ${d.referredBy!.trim()}.`);
      if (nn(d.notes)) noteParts.push(d.notes!.trim());
      const noteBody = noteParts.join(" ").trim();
      if (noteBody.length >= 3) {
        await tx.clientNote.create({
          data: { clientId, authorId: session.user.id, body: noteBody },
        });
      }
    }

    return { contactId: contact.id, clientId };
  });

  revalidatePath("/contactos");
  revalidatePath("/clientes");
  return { ok: true, contactId: res.contactId, clientId: res.clientId };
}
