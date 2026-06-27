// Descarga del BEO como PDF NATIVO (texto seleccionable, vectorial).
// Ruta interna (requiere sesión). El PDF se arma con el loader compartido.

import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { loadBeoPdfData } from "@/lib/beo-doc";
import { BeoPdfDocument } from "@/components/beo/beo-pdf-document";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;
  const data = await loadBeoPdfData({ id });
  if (!data) {
    return new Response("BEO no encontrado", { status: 404 });
  }

  const buffer = await renderToBuffer(BeoPdfDocument(data.props));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
