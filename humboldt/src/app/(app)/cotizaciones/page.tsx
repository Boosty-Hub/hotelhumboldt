import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { formatDayEs } from "@/lib/dates";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { fmtUsd } from "@/lib/money";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { FilePlus2, FileText } from "lucide-react";
import { QuotesToolbar } from "@/components/quote/quotes-toolbar";
import { quoteBaseNumber } from "@/components/quote/quote-utils";
import { QuotesTable, type QuoteGroup, type QuoteRow } from "./_components/quotes-table";

export const metadata = { title: "Cotizaciones" };

function validityLabel(quote: {
  status: string;
  validUntil: Date | null;
}): { text: string; className: string } {
  if (!quote.validUntil) return { text: "—", className: "text-muted-foreground" };
  const days = differenceInCalendarDays(quote.validUntil, new Date());
  const dateStr = format(quote.validUntil, "dd/MM/yyyy", { locale: es });

  // Para estados finales solo se muestra la fecha
  if (!["BORRADOR", "ENVIADA", "VENCIDA"].includes(quote.status)) {
    return { text: dateStr, className: "text-muted-foreground" };
  }
  if (quote.status === "VENCIDA" || days < 0) {
    return {
      text: days < 0 ? `Vencida hace ${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"}` : "Vencida",
      className: "font-medium text-rose-600",
    };
  }
  if (days === 0) return { text: "Vence hoy", className: "font-medium text-amber-600" };
  if (days <= 2)
    return {
      text: `Vence en ${days} ${days === 1 ? "día" : "días"}`,
      className: "font-medium text-amber-600",
    };
  return { text: `Vence en ${days} días`, className: "text-muted-foreground" };
}

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const estado = typeof sp.estado === "string" ? sp.estado : "";

  const where: Prisma.QuoteWhereInput = {};
  if (QUOTE_STATUSES.includes(estado as QuoteStatus)) where.status = estado;
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { opportunity: { title: { contains: q, mode: "insensitive" } } },
      { opportunity: { client: { legalName: { contains: q, mode: "insensitive" } } } },
      { opportunity: { client: { brandName: { contains: q, mode: "insensitive" } } } },
      { event: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      opportunity: { include: { client: true } },
      event: true,
      signer: true,
    },
    orderBy: [{ issueDate: "desc" }, { version: "desc" }],
  });

  const hasFilters = Boolean(q || estado);

  // Agrupar versiones por número base: una línea por cotización, con las
  // versiones anteriores desplegables.
  const groupsMap = new Map<string, QuoteRow[]>();
  for (const quote of quotes) {
    const baseNumber = quoteBaseNumber(quote.number);
    const client = quote.opportunity.client;
    const validity = validityLabel(quote);
    const row: QuoteRow = {
      id: quote.id,
      publicToken: quote.publicToken,
      baseNumber,
      version: quote.version,
      clientName: client.brandName ?? client.legalName,
      clientLegal: client.brandName ? client.legalName : null,
      eventName: quote.event?.name ?? quote.opportunity.title,
      eventDateLabel: quote.event?.startDate
        ? `${formatDayEs(quote.event.startDate, "dd MMM yyyy")}${
            quote.event.datesTentative ? " (tentativa)" : ""
          }`
        : null,
      issueDateLabel: format(quote.issueDate, "dd/MM/yyyy", { locale: es }),
      validityText: validity.text,
      validityClass: validity.className,
      totalUsd: quote.totalUsd,
      status: quote.status,
      signerName: quote.signer.name,
    };
    const arr = groupsMap.get(baseNumber);
    if (arr) arr.push(row);
    else groupsMap.set(baseNumber, [row]);
  }
  const groups: QuoteGroup[] = Array.from(groupsMap, ([baseNumber, versions]) => ({
    baseNumber,
    versions: versions.sort((a, b) => b.version - a.version),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Presupuestos de eventos en USD — factura legal en Bs a tasa BCV.
          </p>
        </div>
        <Button asChild>
          <Link href="/cotizaciones/nueva">
            <FilePlus2 className="h-3.5 w-3.5" />
            Nueva cotización
          </Link>
        </Button>
      </div>

      <QuotesToolbar />

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
            <FileText className="h-6 w-6 text-sky-900" />
          </div>
          <div>
            <p className="font-medium">
              {hasFilters ? "Sin resultados" : "Aún no hay cotizaciones"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {hasFilters
                ? "Prueba con otra búsqueda u otro estado."
                : "Crea la primera cotización para empezar a vender eventos."}
            </p>
          </div>
          {!hasFilters && (
            <Button asChild>
              <Link href="/cotizaciones/nueva">
                <FilePlus2 className="h-3.5 w-3.5" />
                Nueva cotización
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <QuotesTable groups={groups} />
      )}
    </div>
  );
}
