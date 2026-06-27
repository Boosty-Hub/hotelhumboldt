import { notFound } from "next/navigation";
import { auth, canViewCosts } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCommercialParams } from "@/lib/settings";
import { buildCostAnalysis } from "@/lib/quote-calc";
import { quoteBaseNumber } from "@/components/quote/quote-utils";
import { CostReport } from "@/components/quote/cost-report";

export const metadata = { title: "Análisis de costos" };

export default async function CostosCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  // Documento INTERNO: solo roles que ven costos (ADMIN / GERENTE).
  if (!session?.user || !canViewCosts(session.user.role)) notFound();

  // La cotización y los parámetros comerciales son independientes → en paralelo.
  const [quote, { minMarginPct }] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: {
        opportunity: { include: { client: true } },
        event: true,
        signer: { select: { name: true } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
    }),
    getCommercialParams(),
  ]);
  if (!quote) notFound();

  const analysis = buildCostAnalysis(
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

  const client = quote.opportunity.client;

  return (
    <CostReport
      quoteId={quote.id}
      number={quoteBaseNumber(quote.number)}
      version={quote.version}
      status={quote.status}
      clientName={client?.brandName ?? client?.legalName ?? "Sin empresa"}
      clientLegal={client?.legalName ?? ""}
      eventName={quote.event?.name ?? null}
      eventPax={quote.event?.pax ?? null}
      signerName={quote.signer.name}
      analysis={analysis}
      minMarginPct={minMarginPct}
    />
  );
}
