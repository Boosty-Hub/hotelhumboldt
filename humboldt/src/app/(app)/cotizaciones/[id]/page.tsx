import Link from "next/link";
import { notFound } from "next/navigation";
import { isSameDay } from "date-fns";
import { formatDayEs } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { calcQuoteTotals } from "@/lib/quote-calc";
import { SETTING_KEYS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { QuoteDocument } from "@/components/quote/quote-document";
import { QuoteStatusBadge } from "@/components/quote/quote-status-badge";
import { DownloadPdfButton } from "@/components/quote/download-pdf-button";

export const metadata = { title: "Documento de cotización" };

// CSS de impresión: solo el documento, sin el chrome de la app
const PRINT_CSS = `
@media print {
  html, body { height: auto !important; overflow: visible !important; background: white !important; }
  aside, header, .print-hidden { display: none !important; }
  .h-screen { height: auto !important; }
  .overflow-hidden, .overflow-y-auto { overflow: visible !important; }
  main { padding: 0 !important; background: white !important; }
  body * { visibility: hidden; }
  #quote-print-area, #quote-print-area * { visibility: visible; }
  #quote-print-area {
    position: absolute; left: 0; top: 0; width: 100%;
    margin: 0 !important; padding: 0 !important;
    border: none !important; box-shadow: none !important; border-radius: 0 !important;
  }
}
@page { margin: 14mm 12mm; }
`;

export default async function DocumentoCotizacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const autoPrint = (await searchParams).print === "1";

  // Datos del hotel desde Configuración
  const hotelKeys = [
    SETTING_KEYS.HOTEL_NAME,
    SETTING_KEYS.HOTEL_RIF,
    SETTING_KEYS.HOTEL_ADDRESS,
    SETTING_KEYS.HOTEL_PHONE,
    SETTING_KEYS.HOTEL_EMAIL,
  ];
  // La cotización y los settings del hotel son independientes → en paralelo
  // (un round-trip en vez de dos a la DB remota).
  const [quote, settings] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: {
        opportunity: { include: { client: true, contact: true } },
        event: true,
        signer: { select: { name: true, email: true } },
        lines: { orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }] },
      },
    }),
    prisma.setting.findMany({ where: { key: { in: hotelKeys } } }),
  ]);
  if (!quote) notFound();
  const setting = (key: string) => settings.find((s) => s.key === key)?.value ?? null;

  // Totales SIEMPRE recalculados desde las líneas (consistencia garantizada)
  const totals = calcQuoteTotals(
    quote.lines.map((l) => ({
      section: l.section,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      isOptional: l.isOptional,
      taxExempt: l.taxExempt,
      unitCost: l.unitCost,
      costQuantity: l.costQuantity,
    })),
    {
      taxPct: quote.taxPct,
      taxEnabled: quote.taxEnabled,
      servicePct: quote.servicePct,
      serviceEnabled: quote.serviceEnabled,
      depositPct: quote.depositPct,
      depositEnabled: quote.depositEnabled,
      igtfPct: quote.igtfPct,
      igtfEnabled: quote.igtfEnabled,
    },
    quote.managerDiscountPct
  );

  // Etiquetas de fecha/hora del evento
  const event = quote.event;
  let eventDateLabel: string | null = null;
  if (event?.startDate) {
    if (event.endDate && !isSameDay(event.startDate, event.endDate)) {
      eventDateLabel = `Del ${formatDayEs(event.startDate, "d 'de' MMMM")} al ${formatDayEs(
        event.endDate,
        "d 'de' MMMM 'de' yyyy"
      )}`;
    } else {
      eventDateLabel = formatDayEs(event.startDate, "EEEE d 'de' MMMM 'de' yyyy");
      eventDateLabel = eventDateLabel.charAt(0).toUpperCase() + eventDateLabel.slice(1);
    }
  }
  const eventTimeLabel =
    event?.startTime && event?.endTime
      ? `De ${event.startTime} a ${event.endTime}`
      : event?.startTime
        ? `Desde las ${event.startTime}`
        : null;

  const client = quote.opportunity.client;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ── Barra de acciones (no se imprime) ── */}
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/cotizaciones" aria-label="Volver a cotizaciones">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-lg font-bold tracking-tight">Documento del presupuesto</h1>
          <Badge variant="outline">v{quote.version}</Badge>
          <QuoteStatusBadge status={quote.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DownloadPdfButton quoteId={quote.id} auto={autoPrint} />
        </div>
      </div>

      {/* ── Documento ── */}
      <div id="quote-print-area" className="rounded-xl border bg-white p-8 shadow-sm sm:p-10">
        <QuoteDocument
          hotel={{
            name: setting(SETTING_KEYS.HOTEL_NAME) ?? "Hotel Humboldt",
            rif: setting(SETTING_KEYS.HOTEL_RIF),
            address: setting(SETTING_KEYS.HOTEL_ADDRESS),
            phone: setting(SETTING_KEYS.HOTEL_PHONE),
            email: setting(SETTING_KEYS.HOTEL_EMAIL),
          }}
          number={quote.number}
          version={quote.version}
          issueDate={quote.issueDate.toISOString()}
          validUntil={quote.validUntil?.toISOString() ?? null}
          clientName={
            client ? client.legalName : (quote.opportunity.contact?.name ?? "Sin empresa")
          }
          clientBrand={client?.brandName ?? null}
          clientRif={client?.rif ?? null}
          contactName={quote.opportunity.contact?.name ?? null}
          eventName={event?.name ?? quote.opportunity.title}
          eventDateLabel={eventDateLabel}
          eventTimeLabel={eventTimeLabel}
          eventPax={event?.pax ?? null}
          paxApproximate={event?.paxApproximate ?? false}
          datesTentative={event?.datesTentative ?? false}
          clientMessage={quote.clientMessage}
          legalConditions={quote.legalConditions}
          signerName={quote.signer.name}
          signerEmail={quote.signer.email}
          lines={quote.lines.map((l) => ({
            section: l.section,
            dayNumber: l.dayNumber,
            description: l.description,
            comment: l.comment,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
            isOptional: l.isOptional,
          }))}
          totals={{
            subtotalMisc: totals.subtotalMisc,
            subtotalTransfers: totals.subtotalTransfers,
            subtotalFood: totals.subtotalFood,
            subtotalSpaces: totals.subtotalSpaces,
            discountPct: totals.discountPct,
            discountAmount: totals.discountAmount,
            taxableBase: totals.taxableBase,
            serviceAmount: totals.serviceAmount,
            taxAmount: totals.taxAmount,
            totalUsd: totals.totalUsd,
            depositAmount: totals.depositAmount,
            totalWithDeposit: totals.totalWithDeposit,
            igtfAmount: totals.igtfAmount,
          }}
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
        />
      </div>
    </div>
  );
}
