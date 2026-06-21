// Link público de aprobación — /cotizacion/[token]
// Página SIN login (excluida en src/proxy.ts). El cliente final la abre desde
// su teléfono: revisa el presupuesto, lo aprueba o solicita cambios.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format, isSameDay, differenceInCalendarDays } from "date-fns";
import { formatDayEs } from "@/lib/dates";
import { es } from "date-fns/locale";
import { Logo } from "@/components/logo";
import {
  CalendarDays,
  Clock3,
  Users,
  CalendarClock,
  CheckCircle2,
  TriangleAlert,
  MessageSquareText,
  Mail,
  Phone,
  FileCheck2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { calcQuoteTotals } from "@/lib/quote-calc";
import { SETTING_KEYS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { QuoteDocument } from "@/components/quote/quote-document";
import { quoteBaseNumber } from "@/components/quote/quote-utils";
import { PrintButton } from "@/components/quote/print-button";
import { PublicActionBar } from "./public-action-bar";

export const metadata: Metadata = {
  title: "Presupuesto de evento",
  robots: { index: false, follow: false },
};

// CSS de impresión: solo el documento, sin header/banners/barra de acciones
const PRINT_CSS = `
@media print {
  html, body { height: auto !important; overflow: visible !important; background: white !important; }
  .print-hidden { display: none !important; }
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

function fdate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: es });
}

export default async function CotizacionPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    include: {
      opportunity: { include: { client: true, contact: true } },
      event: true,
      signer: true,
      lines: { orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }] },
    },
  });
  // Borradores nunca se exponen al cliente
  if (!quote || quote.status === "BORRADOR") notFound();

  // ── Primera visita: registrar apertura (update atómico evita duplicados) ──
  if (!quote.publicViewedAt) {
    try {
      const marked = await prisma.quote.updateMany({
        where: { id: quote.id, publicViewedAt: null },
        data: { publicViewedAt: new Date() },
      });
      if (marked.count > 0) {
        await prisma.activity.create({
          data: {
            userId: quote.signerId,
            opportunityId: quote.opportunityId,
            quoteId: quote.id,
            type: "SISTEMA",
            body: `El cliente abrió la cotización ${quoteBaseNumber(quote.number)} desde el link público`,
          },
        });
      }
    } catch (e) {
      console.error("registro de apertura del link público", e);
    }
  }

  // ── Datos del hotel desde Configuración ──
  const hotelKeys = [
    SETTING_KEYS.HOTEL_NAME,
    SETTING_KEYS.HOTEL_RIF,
    SETTING_KEYS.HOTEL_ADDRESS,
    SETTING_KEYS.HOTEL_PHONE,
    SETTING_KEYS.HOTEL_EMAIL,
  ];
  const settings = await prisma.setting.findMany({ where: { key: { in: hotelKeys } } });
  const setting = (key: string) => settings.find((s) => s.key === key)?.value ?? null;
  const hotelName = setting(SETTING_KEYS.HOTEL_NAME) ?? "Hotel Humboldt";
  const hotelPhone = setting(SETTING_KEYS.HOTEL_PHONE);

  // ── Totales SIEMPRE recalculados desde las líneas ──
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
    }
  );

  // ── Etiquetas de fecha/hora del evento ──
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
  const clientDisplay = client.brandName ?? client.legalName;
  const base = quoteBaseNumber(quote.number);
  const signer = quote.signer;

  // ── Vigencia ──
  const daysLeft = quote.validUntil
    ? differenceInCalendarDays(quote.validUntil, new Date())
    : null;
  const dateExpired = daysLeft !== null && daysLeft < 0;
  const expired = quote.status === "VENCIDA" || (quote.status === "ENVIADA" && dateExpired);
  const actionable = quote.status === "ENVIADA" && !dateExpired;
  const daysLabel =
    daysLeft === null
      ? null
      : daysLeft === 0
        ? "Vence hoy"
        : daysLeft === 1
          ? "Queda 1 día"
          : `Quedan ${daysLeft} días`;

  return (
    <div className="min-h-screen bg-zinc-100">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ── Header de marca (gradiente, como el login) ─────────────── */}
      <header className="print-hidden bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-900 text-white">
        <div className="mx-auto max-w-4xl px-4 pt-8 pb-14 sm:px-6 sm:pt-10 sm:pb-16">
          <div className="flex items-center gap-3">
            <Logo variant="light" className="h-11 w-auto" />
            <p className="text-[11px] text-sky-300/80">Caracas · Waraira Repano</p>
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
            Presupuesto {base}
            {quote.version > 1 && ` · versión ${quote.version}`}
          </p>
          <h1 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {event?.name ?? quote.opportunity.title}
          </h1>
          <p className="mt-1 text-sm text-sky-200">
            Preparado especialmente para{" "}
            <span className="font-medium text-white">{clientDisplay}</span>
          </p>

          {(eventDateLabel || eventTimeLabel || event?.pax != null) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-sky-100/90">
              {eventDateLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-sky-300" />
                  {eventDateLabel}
                  {event?.datesTentative && (
                    <span className="text-xs italic text-sky-300">(por confirmar)</span>
                  )}
                </span>
              )}
              {eventTimeLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 text-sky-300" />
                  {eventTimeLabel}
                </span>
              )}
              {event?.pax != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-sky-300" />
                  {event.pax} invitados{event.paxApproximate ? " (aprox.)" : ""}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-4 px-3 pb-32 sm:px-6 -mt-8">
        {/* ── Banner según estado ──────────────────────────────────── */}
        {actionable && (
          <div className="print-hidden flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
            <CalendarClock className="h-5 w-5 shrink-0 text-sky-700" />
            <p className="min-w-0 flex-1 text-sm text-sky-900">
              {quote.validUntil ? (
                <>
                  <span className="font-semibold">
                    Válida hasta el {fdate(quote.validUntil)}.
                  </span>{" "}
                  Puedes aprobarla o solicitar cambios desde esta misma página.
                </>
              ) : (
                <>
                  <span className="font-semibold">Cotización vigente.</span> Puedes
                  aprobarla o solicitar cambios desde esta misma página.
                </>
              )}
            </p>
            {daysLabel && (
              <Badge
                variant="outline"
                className={
                  daysLeft !== null && daysLeft <= 1
                    ? "border-amber-300 bg-amber-100 text-amber-800"
                    : "border-sky-300 bg-white text-sky-800"
                }
              >
                {daysLabel}
              </Badge>
            )}
          </div>
        )}

        {expired && (
          <div className="print-hidden flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="font-semibold text-amber-900">
                Esta cotización está vencida
                {quote.validUntil && ` desde el ${fdate(quote.validUntil)}`}.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-800">
                Los precios y la disponibilidad pueden haber cambiado, por lo que ya no
                es posible aprobarla en línea. Contacta a{" "}
                <span className="font-medium">{signer.name}</span> para recibir una
                versión actualizada:
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {signer.email && (
                  <a
                    href={`mailto:${signer.email}`}
                    className="inline-flex items-center gap-1.5 font-medium text-amber-900 underline underline-offset-2"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {signer.email}
                  </a>
                )}
                {hotelPhone && (
                  <span className="inline-flex items-center gap-1.5 text-amber-900">
                    <Phone className="h-3.5 w-3.5" />
                    {hotelPhone}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {(quote.status === "APROBADA" || quote.status === "CONTRATADA") && (
          <div className="print-hidden flex gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 shadow-sm">
            {quote.status === "CONTRATADA" ? (
              <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-emerald-900">
                {quote.status === "CONTRATADA"
                  ? "Cotización aprobada y contratada — el evento está confirmado."
                  : "Cotización aprobada."}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                Aprobada por{" "}
                <span className="font-medium">{quote.approvedByName ?? "el cliente"}</span>
                {quote.approvedAt && <> el {fdate(quote.approvedAt)}</>}.{" "}
                {signer.name} coordinará contigo los próximos pasos.
              </p>
            </div>
          </div>
        )}

        {quote.status === "RECHAZADA" && (
          <div className="print-hidden flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 shadow-sm">
            <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div className="min-w-0">
              <p className="font-semibold text-rose-900">
                Se registró una solicitud de cambios para esta cotización.
              </p>
              {quote.rejectionNote && (
                <p className="mt-1.5 rounded-lg border border-rose-200 bg-white/70 px-3 py-2 text-sm italic leading-relaxed text-rose-800">
                  “{quote.rejectionNote}”
                </p>
              )}
              <p className="mt-1.5 text-sm text-rose-800">
                {signer.name} y el equipo comercial te contactarán a la brevedad con una
                propuesta ajustada.
              </p>
            </div>
          </div>
        )}

        {/* ── Imprimir / PDF ───────────────────────────────────────── */}
        <div className="print-hidden flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            Documento electrónico — puedes guardarlo o imprimirlo.
          </p>
          <PrintButton />
        </div>

        {/* ── Documento del presupuesto (reutilizado del cotizador) ── */}
        <div
          id="quote-print-area"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-10"
        >
          <QuoteDocument
            hotel={{
              name: hotelName,
              rif: setting(SETTING_KEYS.HOTEL_RIF),
              address: setting(SETTING_KEYS.HOTEL_ADDRESS),
              phone: hotelPhone,
              email: setting(SETTING_KEYS.HOTEL_EMAIL),
            }}
            number={quote.number}
            version={quote.version}
            issueDate={quote.issueDate.toISOString()}
            validUntil={quote.validUntil?.toISOString() ?? null}
            clientName={client.legalName}
            clientBrand={client.brandName}
            clientRif={client.rif}
            contactName={quote.opportunity.contact?.name ?? null}
            eventName={event?.name ?? quote.opportunity.title}
            eventDateLabel={eventDateLabel}
            eventTimeLabel={eventTimeLabel}
            eventPax={event?.pax ?? null}
            paxApproximate={event?.paxApproximate ?? false}
            datesTentative={event?.datesTentative ?? false}
            clientMessage={quote.clientMessage}
            legalConditions={quote.legalConditions}
            signerName={signer.name}
            signerEmail={signer.email}
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

        {/* ── Pie de página ────────────────────────────────────────── */}
        <footer className="print-hidden pt-2 pb-4 text-center text-xs text-zinc-400">
          <p>
            {hotelName} · Caracas, Venezuela — documento generado electrónicamente.
          </p>
          {signer.email && (
            <p className="mt-0.5">
              ¿Dudas sobre este presupuesto? Escribe a{" "}
              <a
                href={`mailto:${signer.email}`}
                className="font-medium text-zinc-500 underline underline-offset-2"
              >
                {signer.email}
              </a>
            </p>
          )}
        </footer>
      </main>

      {/* ── Barra de acciones sticky (aprobar / solicitar cambios) ── */}
      <PublicActionBar
        token={token}
        actionable={actionable}
        totalUsd={totals.totalUsd}
        depositAmount={totals.depositAmount}
        signerName={signer.name}
      />
    </div>
  );
}
