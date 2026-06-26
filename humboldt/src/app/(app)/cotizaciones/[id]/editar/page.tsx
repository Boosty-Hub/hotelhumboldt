import { notFound } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { auth, canViewCosts, canApplyQuoteDiscount } from "@/lib/auth";
import { getCurrentRate, getParallelRate } from "@/lib/bcv";
import { getCommercialParams } from "@/lib/settings";
import type { Section } from "@/lib/constants";
import { QuoteEditor } from "@/components/quote/quote-editor";
import {
  quoteBaseNumber,
  type CatalogProduct,
  type EditorLine,
} from "@/components/quote/quote-utils";

export const metadata = { title: "Editor de cotización" };

export default async function EditarCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const showCosts = canViewCosts(session?.user?.role);
  const canApplyDiscount = canApplyQuoteDiscount(session?.user?.role);

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      opportunity: { include: { client: true } },
      event: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { discountAuthor: { select: { name: true } } },
      },
    },
  });
  if (!quote) notFound();

  // Catálogo activo agrupado por categoría
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });

  // ¿Existe una versión más reciente de este número?
  const base = quoteBaseNumber(quote.number);
  const newer = await prisma.quote.findFirst({
    where: {
      opportunityId: quote.opportunityId,
      OR: [{ number: base }, { number: { startsWith: `${base}-V` } }],
      version: { gt: quote.version },
    },
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });

  const bcv = await getCurrentRate();
  const parallel = await getParallelRate();
  const { minMarginPct } = await getCommercialParams();

  const eventDays =
    quote.event?.startDate && quote.event?.endDate
      ? Math.max(
          differenceInCalendarDays(quote.event.endDate, quote.event.startDate) + 1,
          1
        )
      : 1;

  const initialLines: EditorLine[] = quote.lines.map((l) => ({
    id: l.id,
    uid: l.id,
    section: l.section as Section,
    dayNumber: l.dayNumber,
    productId: l.productId,
    description: l.description,
    comment: l.comment ?? "",
    listPrice: l.listPrice,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    unit: l.unit,
    isOptional: l.isOptional,
    taxExempt: l.taxExempt,
    sortOrder: l.sortOrder,
    discountType: l.discountType,
    discountReason: l.discountReason,
    discountAuthorName: l.discountAuthor?.name ?? null,
    // Costeo interno: nunca llega al cliente sin permiso
    unitCost: showCosts ? l.unitCost : null,
    costQuantity: showCosts ? l.costQuantity : null,
    supplierId: showCosts ? l.supplierId : null,
  }));

  const catalog: CatalogProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    categoryName: p.category?.name ?? "Sin categoría",
    section: (p.category?.section as Section | null) ?? null,
    type: p.type,
    unit: p.unit,
    listPrice: p.listPrice,
    minPax: p.minPax,
    unitsPerPax: p.unitsPerPax,
    priceContext: p.priceContext,
    cost: showCosts ? p.cost : null,
    supplierId: showCosts ? p.supplierId : null,
  }));

  const client = quote.opportunity.client;

  return (
    <QuoteEditor
      quoteId={quote.id}
      opportunityId={quote.opportunityId}
      eventId={quote.eventId}
      number={quote.number}
      version={quote.version}
      status={quote.status}
      publicToken={quote.publicToken}
      params={{
        taxPct: quote.taxPct,
        taxEnabled: quote.taxEnabled,
        servicePct: quote.servicePct,
        serviceEnabled: quote.serviceEnabled,
        depositPct: quote.depositPct,
        depositEnabled: quote.depositEnabled,
        igtfPct: quote.igtfPct,
        igtfEnabled: quote.igtfEnabled,
      }}
      clientName={client.brandName ?? client.legalName}
      eventName={quote.event?.name ?? null}
      eventPax={quote.event?.pax ?? null}
      eventDays={eventDays}
      initialLines={initialLines}
      catalog={catalog}
      canViewCosts={showCosts}
      currentUserName={session?.user?.name ?? "—"}
      bcvRate={bcv?.rate ?? null}
      parallelRate={parallel?.rate ?? null}
      initialRateKind={quote.rateKind}
      newerVersion={newer}
      minMarginPct={minMarginPct}
      canApplyDiscount={canApplyDiscount}
      initialDiscountPct={quote.managerDiscountPct}
      initialDiscountReason={quote.managerDiscountReason ?? ""}
    />
  );
}
