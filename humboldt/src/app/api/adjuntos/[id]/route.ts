import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedUrl } from "@/lib/storage";

function isManager(role?: string): boolean {
  return role === "ADMIN" || role === "GERENTE";
}

/** Descarga/visualización de un adjunto: valida sesión + pertenencia y redirige
 *  a una URL firmada temporal del bucket privado. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("No autorizado", { status: 401 });

  const { id } = await params;
  const att = await prisma.attachment.findUnique({
    where: { id },
    include: { opportunity: { select: { ownerId: true } } },
  });
  if (!att) return new Response("Adjunto no encontrado", { status: 404 });

  // Misma regla que upload/delete: ADMIN/GERENTE o el ejecutivo dueño.
  const canView = isManager(session.user.role) || session.user.id === att.opportunity.ownerId;
  if (!canView) return new Response("No autorizado", { status: 403 });

  try {
    const url = await createSignedUrl(att.path, 120, att.fileName);
    return Response.redirect(url, 302);
  } catch {
    return new Response("No se pudo generar el enlace de descarga", { status: 500 });
  }
}
