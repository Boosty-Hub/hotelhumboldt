// Descarga pública del BEO como PDF NATIVO. Sin autenticación: el publicToken
// del link ES la credencial de acceso (igual que la vista /orden/[token]).

import { renderToBuffer } from "@react-pdf/renderer";
import { loadBeoPdfData } from "@/lib/beo-doc";
import { BeoPdfDocument } from "@/components/beo/beo-pdf-document";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadBeoPdfData({ publicToken: token });
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
