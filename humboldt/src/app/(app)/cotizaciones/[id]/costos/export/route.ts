import { auth, canViewCosts } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCostAnalysis } from "@/lib/quote-calc";
import { quoteBaseNumber } from "@/components/quote/quote-utils";
import { SECTION_LABELS } from "@/lib/constants";

/**
 * Exporta el análisis de costos como CSV (UTF-8 con BOM, separador ';' →
 * abre directo en Excel con acentos y columnas correctas). INTERNO: solo
 * roles con visibilidad de costos.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !canViewCosts(session.user.role)) {
    return new Response("No autorizado", { status: 403 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      opportunity: { include: { client: true } },
      event: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) return new Response("Cotización no encontrada", { status: 404 });

  const a = buildCostAnalysis(
    quote.lines.map((l) => ({
      section: l.section,
      description: l.description,
      unit: l.unit,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      isOptional: l.isOptional,
      unitCost: l.unitCost,
      costQuantity: l.costQuantity,
    }))
  );

  const num = quoteBaseNumber(quote.number);
  const client =
    quote.opportunity.client?.brandName ?? quote.opportunity.client?.legalName ?? "Sin empresa";

  // Número con coma decimal (convención Excel español); vacío si null.
  const n = (x: number | null) => (x == null ? "" : x.toFixed(2).replace(".", ","));
  const esc = (s: string) => (/[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  const rows: string[][] = [
    ["Análisis de costos (documento interno)"],
    ["Cotización", num],
    ["Cliente", client],
  ];
  if (quote.event?.name) rows.push(["Evento", quote.event.name]);
  rows.push([]);
  rows.push([
    "Sección",
    "Descripción",
    "Cantidad",
    "Unidad",
    "Costo unitario",
    "Costo total",
    "Precio venta",
    "Subtotal venta",
    "Ganancia",
    "Margen %",
  ]);

  for (const s of a.sections) {
    const label = SECTION_LABELS[s.section];
    for (const l of s.lines) {
      rows.push([
        label,
        l.description,
        l.isOptional ? "0" : String(l.quantity),
        l.unit,
        n(l.unitCost),
        n(l.cost),
        n(l.unitPrice),
        n(l.sale),
        n(l.profit),
        l.marginPct == null ? "" : n(l.marginPct),
      ]);
    }
    rows.push([
      `Subtotal ${label}`,
      "",
      "",
      "",
      "",
      n(s.cost),
      "",
      n(s.sale),
      n(s.profit),
      s.marginPct == null ? "" : n(s.marginPct),
    ]);
  }

  rows.push([]);
  rows.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    n(a.totalCost),
    "",
    n(a.totalSale),
    n(a.grossMargin),
    n(a.grossMarginPct),
  ]);

  const csv =
    "﻿" + rows.map((r) => r.map((c) => esc(String(c ?? ""))).join(";")).join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analisis-costos-${num}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
