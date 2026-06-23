"use server";

// Adjuntos del expediente (fotos, PDF, contratos) por oportunidad.
// Suben/eliminan: ADMIN, GERENTE o el ejecutivo dueño. Todos pueden ver.

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { uploadToBucket, removeFromBucket } from "@/lib/storage";

export type AttachmentDTO = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedByName: string;
  canDelete: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EXACT = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
// Tipos renderizables en el navegador: nunca, aunque digan ser "imagen".
const BLOCKED_MIME = new Set(["image/svg+xml", "text/html", "application/xhtml+xml"]);
function isAllowed(mime: string): boolean {
  if (BLOCKED_MIME.has(mime)) return false;
  return mime.startsWith("image/") || ALLOWED_EXACT.has(mime);
}

/** El tipo lo declara el cliente y es falsificable: validamos el contenido real. */
function looksLikeMarkup(bytes: Uint8Array): boolean {
  const head = new TextDecoder("ascii").decode(bytes.subarray(0, 64)).trim().toLowerCase();
  return (
    head.startsWith("<") ||
    head.includes("<svg") ||
    head.includes("<html") ||
    head.includes("<!doctype") ||
    head.includes("<?xml")
  );
}
function magicMatches(bytes: Uint8Array, mime: string): boolean {
  const sig = (s: number[]) => s.every((v, i) => bytes[i] === v);
  if (mime === "application/pdf") return sig([0x25, 0x50, 0x44, 0x46]); // %PDF
  if (ALLOWED_EXACT.has(mime)) {
    // docx/xlsx = ZIP (PK..), doc/xls antiguos = OLE compound file.
    return sig([0x50, 0x4b, 0x03, 0x04]) || sig([0x50, 0x4b, 0x05, 0x06]) || sig([0xd0, 0xcf, 0x11, 0xe0]);
  }
  // Imágenes: cualquier binario sirve mientras no sea markup (png/jpg/gif/webp/heic…).
  return true;
}

function isManager(role?: string): boolean {
  return role === "ADMIN" || role === "GERENTE";
}

/** Lista los adjuntos de una oportunidad (todos los usuarios pueden ver). */
export async function listAttachments(opportunityId: string): Promise<AttachmentDTO[]> {
  const session = await auth();
  if (!session?.user || !opportunityId) return [];
  const rows = await prisma.attachment.findMany({
    where: { opportunityId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  });
  const manager = isManager(session.user.role);
  return rows.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    size: a.size,
    createdAt: a.createdAt.toISOString(),
    uploadedByName: a.uploadedBy.name,
    canDelete: manager || a.uploadedById === session.user.id,
  }));
}

/** Sube un archivo a la oportunidad. FormData: opportunityId + file. */
export async function uploadAttachment(formData: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };

  const opportunityId = String(formData.get("opportunityId") ?? "");
  const file = formData.get("file");
  if (!opportunityId) return { ok: false, error: "Oportunidad inválida." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Archivo inválido." };

  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, ownerId: true },
  });
  if (!opp) return { ok: false, error: "La oportunidad no existe." };

  const canManage = isManager(session.user.role) || session.user.id === opp.ownerId;
  if (!canManage) return { ok: false, error: "No tenés permiso para adjuntar en esta oportunidad." };

  if (file.size > MAX_SIZE) return { ok: false, error: "El archivo supera 15 MB." };
  if (!isAllowed(file.type)) {
    return { ok: false, error: "Tipo no permitido (imágenes, PDF, Word o Excel)." };
  }

  const safe = (file.name || "archivo").replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = `${opportunityId}/${nanoid(12)}-${safe}`;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // El tipo declarado es falsificable: validamos el contenido real (anti-spoofing/XSS).
    if (looksLikeMarkup(bytes) || !magicMatches(bytes, file.type)) {
      return { ok: false, error: "El contenido del archivo no coincide con su tipo. Subí un PDF, imagen, Word o Excel válido." };
    }
    await uploadToBucket(path, bytes, file.type);
    await prisma.attachment.create({
      data: {
        opportunityId,
        fileName: file.name || safe,
        path,
        mimeType: file.type,
        size: file.size,
        uploadedById: session.user.id,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo subir el archivo." };
  }

  revalidatePath("/pipeline");
  return { ok: true };
}

/** Elimina un adjunto (dueño del archivo o ADMIN/GERENTE). */
export async function deleteAttachment(id: string): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado." };

  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return { ok: false, error: "El adjunto no existe." };

  const canDelete = isManager(session.user.role) || att.uploadedById === session.user.id;
  if (!canDelete) return { ok: false, error: "No tenés permiso para eliminar este adjunto." };

  await removeFromBucket(att.path);
  await prisma.attachment.delete({ where: { id } });
  revalidatePath("/pipeline");
  return { ok: true };
}
