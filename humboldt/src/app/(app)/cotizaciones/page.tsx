import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { formatDayEs } from "@/lib/dates";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { fmtUsd } from "@/lib/money";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FilePlus2, FileText, Eye, Pencil } from "lucide-react";
import { QuotesToolbar } from "@/components/quote/quotes-toolbar";
import { QuoteStatusBadge } from "@/components/quote/quote-status-badge";
import { quoteBaseNumber } from "@/components/quote/quote-utils";
import { cn } from "@/lib/utils";

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
      { number: { contains: q } },
      { opportunity: { title: { contains: q } } },
      { opportunity: { client: { legalName: { contains: q } } } },
      { opportunity: { client: { brandName: { contains: q } } } },
      { event: { name: { contains: q } } },
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
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Firmante</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => {
                const validity = validityLabel(quote);
                const client = quote.opportunity.client;
                return (
                  <TableRow key={quote.id} className="group">
                    <TableCell>
                      <Link
                        href={`/cotizaciones/${quote.id}/editar`}
                        className="flex items-center gap-1.5 font-medium text-sky-950 hover:underline dark:text-sky-200"
                      >
                        {quoteBaseNumber(quote.number)}
                        {quote.version > 1 && (
                          <Badge variant="outline" className="text-[10px]">
                            v{quote.version}
                          </Badge>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-44 truncate font-medium">
                        {client.brandName ?? client.legalName}
                      </p>
                      {client.brandName && (
                        <p className="max-w-44 truncate text-xs text-muted-foreground">
                          {client.legalName}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48">
                      <p className="truncate">{quote.event?.name ?? quote.opportunity.title}</p>
                      {quote.event?.startDate && (
                        <p className="text-xs text-muted-foreground">
                          {formatDayEs(quote.event.startDate, "dd MMM yyyy")}
                          {quote.event.datesTentative && " (tentativa)"}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(quote.issueDate, "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-sm", validity.className)}>{validity.text}</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtUsd(quote.totalUsd)}
                    </TableCell>
                    <TableCell>
                      <QuoteStatusBadge status={quote.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{quote.signer.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link
                            href={`/cotizaciones/${quote.id}/editar`}
                            aria-label="Editar cotización"
                          >
                            <Pencil className="h-3 w-3" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/cotizaciones/${quote.id}`} aria-label="Ver documento">
                            <Eye className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
