// Descarga del documento de cotización como PDF NATIVO (texto seleccionable,
// vectorial). Se renderiza en el servidor con @react-pdf/renderer.

import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { loadQuoteDocData } from "@/lib/quote-doc";
import { QuotePdfDocument } from "@/components/quote/quote-pdf-document";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;
  const data = await loadQuoteDocData(id);
  if (!data) {
    return new Response("Cotización no encontrada", { status: 404 });
  }

  const buffer = await renderToBuffer(QuotePdfDocument(data.props));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
