import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedUrl } from "@/lib/storage";

/** Descarga/visualización de un adjunto: valida sesión y redirige a una URL
 *  firmada temporal del bucket privado. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("No autorizado", { status: 401 });

  const { id } = await params;
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return new Response("Adjunto no encontrado", { status: 404 });

  try {
    const url = await createSignedUrl(att.path, 120);
    return Response.redirect(url, 302);
  } catch {
    return new Response("No se pudo generar el enlace de descarga", { status: 500 });
  }
}
