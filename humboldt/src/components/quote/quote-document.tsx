// Documento de cotización — vista limpia imprimible para el CLIENTE.
// Componente PURO: recibe todo por props planas, sin imports de auth/prisma.
// El módulo del link público (/cotizacion/[token]) lo reutiliza tal cual.

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { fmtUsd, fmtPct, fmtNum } from "@/lib/money";
import { SECTIONS, SECTION_LABELS, type Section } from "@/lib/constants";
import { quoteBaseNumber } from "@/components/quote/quote-utils";

export interface QuoteDocumentLine {
  section: string;
  dayNumber: number | null;
  description: string;
  comment: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  isOptional: boolean;
}

export interface QuoteDocumentProps {
  hotel: {
    name: string;
    rif: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  number: string;
  version: number;
  issueDate: string; // ISO
  validUntil: string | null; // ISO
  clientName: string;
  clientBrand: string | null;
  clientRif: string | null;
  contactName: string | null;
  eventName: string | null;
  eventDateLabel: string | null;
  eventTimeLabel: string | null;
  eventPax: number | null;
  paxApproximate: boolean;
  datesTentative: boolean;
  clientMessage: string | null;
  legalConditions: string | null;
  signerName: string;
  signerEmail: string | null;
  lines: QuoteDocumentLine[];
  totals: {
    subtotalMisc: number;
    subtotalTransfers: number;
    subtotalFood: number;
    subtotalSpaces: number;
    discountPct: number;
    discountAmount: number;
    taxableBase: number;
    serviceAmount: number;
    taxAmount: number;
    totalUsd: number;
    depositAmount: number;
    totalWithDeposit: number;
    igtfAmount: number;
  };
  params: {
    taxPct: number;
    taxEnabled: boolean;
    servicePct: number;
    serviceEnabled: boolean;
    depositPct: number;
    depositEnabled: boolean;
    igtfPct: number;
    igtfEnabled: boolean;
  };
}

const UNIT_SHORT: Record<string, string> = {
  UND: "und",
  PAX: "p/p",
  BOTELLA: "bot.",
  DIA: "día",
  EVENTO: "evento",
  VEHICULO: "vehículo",
  KG: "kg",
  CAJA: "caja",
  HORA: "hora",
};

function fdate(iso: string | null): string | null {
  if (!iso) return null;
  return format(new Date(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
}

export function QuoteDocument(props: QuoteDocumentProps) {
  const { hotel, totals, params } = props;
  const multiDay = props.lines.some((l) => (l.dayNumber ?? 1) > 1);

  const sectionsWithLines = SECTIONS.filter((s) =>
    props.lines.some((l) => l.section === s)
  );

  const sectionSubtotal: Record<Section, number> = {
    MISCELANEOS: totals.subtotalMisc,
    TRASLADOS: totals.subtotalTransfers,
    ALIMENTOS_BEBIDAS: totals.subtotalFood,
    ESPACIOS: totals.subtotalSpaces,
  };

  const legalItems = (props.legalConditions ?? "")
    .split("\n")
    .map((s) => s.replace(/^\s*\d+[.)-]\s*/, "").trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl bg-white text-zinc-900 print:max-w-none">
      {/* ── Encabezado del hotel ───────────────────────────────── */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-sky-950 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">{hotel.name}</h1>
          {hotel.rif && <p className="text-xs text-zinc-500">RIF {hotel.rif}</p>}
          {hotel.address && <p className="mt-1 text-xs text-zinc-500">{hotel.address}</p>}
          <p className="text-xs text-zinc-500">
            {[hotel.phone, hotel.email].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Presupuesto
          </p>
          <p className="text-xl font-bold text-sky-950">{quoteBaseNumber(props.number)}</p>
          {props.version > 1 && (
            <p className="text-xs font-medium text-zinc-500">Versión {props.version}</p>
          )}
          <p className="mt-1 text-xs text-zinc-500">Emitido: {fdate(props.issueDate)}</p>
          {props.validUntil && (
            <p className="text-xs text-zinc-500">Válido hasta: {fdate(props.validUntil)}</p>
          )}
        </div>
      </header>

      {/* ── Cliente y evento ───────────────────────────────────── */}
      <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Cliente
          </p>
          <p className="mt-1 text-sm font-semibold">{props.clientName}</p>
          {props.clientBrand && <p className="text-xs text-zinc-500">{props.clientBrand}</p>}
          {props.clientRif && <p className="text-xs text-zinc-500">RIF {props.clientRif}</p>}
          {props.contactName && (
            <p className="mt-1 text-xs text-zinc-500">Atención: {props.contactName}</p>
          )}
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Evento
          </p>
          <p className="mt-1 text-sm font-semibold">{props.eventName ?? "—"}</p>
          {props.eventDateLabel && (
            <p className="text-xs text-zinc-500">
              {props.eventDateLabel}
              {props.datesTentative && (
                <span className="ml-1 italic text-amber-700">(fechas por confirmar)</span>
              )}
            </p>
          )}
          {props.eventTimeLabel && <p className="text-xs text-zinc-500">{props.eventTimeLabel}</p>}
          {props.eventPax != null && (
            <p className="text-xs text-zinc-500">
              {props.eventPax} invitados{props.paxApproximate ? " (aprox.)" : ""}
            </p>
          )}
        </div>
      </section>

      {/* ── Mensaje de cortesía ────────────────────────────────── */}
      {props.clientMessage && (
        <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
          {props.clientMessage}
        </p>
      )}

      {/* ── Secciones ──────────────────────────────────────────── */}
      <div className="mt-6 space-y-6">
        {sectionsWithLines.map((section) => {
          const sectionLines = props.lines
            .filter((l) => l.section === section)
            .sort((a, b) => (a.dayNumber ?? 0) - (b.dayNumber ?? 0));
          const days = multiDay
            ? [...new Set(sectionLines.map((l) => l.dayNumber ?? 0))].sort((a, b) => a - b)
            : [0];

          return (
            <section key={section} className="break-inside-avoid-page">
              <h2 className="mb-2 flex items-baseline justify-between border-b border-zinc-300 pb-1.5">
                <span className="text-sm font-bold uppercase tracking-wide text-sky-950">
                  {SECTION_LABELS[section]}
                  {section === "TRASLADOS" && (
                    <span className="ml-2 text-[10px] font-medium normal-case tracking-normal text-zinc-400">
                      Exento de IVA
                    </span>
                  )}
                </span>
                <span className="text-xs font-semibold text-zinc-500">
                  {fmtUsd(sectionSubtotal[section])}
                </span>
              </h2>

              {days.map((day) => {
                const dayLines = multiDay
                  ? sectionLines.filter((l) => (l.dayNumber ?? 0) === day)
                  : sectionLines;
                if (dayLines.length === 0) return null;
                return (
                  <div key={day}>
                    {multiDay && day > 0 && (
                      <p className="mt-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        Día {day}
                      </p>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-400">
                          <th className="py-1 pr-2 font-medium">Descripción</th>
                          <th className="w-16 py-1 pr-2 text-right font-medium">Cant.</th>
                          <th className="w-16 py-1 pr-2 font-medium">Unidad</th>
                          <th className="w-24 py-1 pr-2 text-right font-medium">Precio</th>
                          <th className="w-24 py-1 text-right font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {dayLines.map((l, i) => (
                          <tr key={i} className={l.isOptional ? "text-zinc-400" : ""}>
                            <td className="py-1.5 pr-2 align-top">
                              <p className={l.isOptional ? "italic" : ""}>
                                {l.description}
                                {l.isOptional && (
                                  <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide">
                                    (referencial)
                                  </span>
                                )}
                              </p>
                              {l.comment && (
                                <p className="mt-0.5 whitespace-pre-line text-xs leading-snug text-zinc-500">
                                  {l.comment}
                                </p>
                              )}
                            </td>
                            <td className="py-1.5 pr-2 text-right align-top tabular-nums">
                              {fmtNum(l.quantity, Number.isInteger(l.quantity) ? 0 : 2)}
                            </td>
                            <td className="py-1.5 pr-2 align-top text-xs text-zinc-500">
                              {UNIT_SHORT[l.unit] ?? l.unit.toLowerCase()}
                            </td>
                            <td className="py-1.5 pr-2 text-right align-top tabular-nums">
                              {fmtUsd(l.unitPrice)}
                            </td>
                            <td className="py-1.5 text-right align-top font-medium tabular-nums">
                              {l.isOptional ? "—" : fmtUsd(l.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {/* ── Totales (formato Hotel Humboldt) ───────────────────── */}
      <section className="mt-8 flex justify-end break-inside-avoid-page">
        <div className="w-full max-w-sm text-sm">
          <div className="space-y-1.5">
            {totals.subtotalMisc > 0 && (
              <Row label="Total Misceláneos" value={fmtUsd(totals.subtotalMisc)} />
            )}
            {totals.subtotalFood > 0 && (
              <Row label="Total AyB" value={fmtUsd(totals.subtotalFood)} />
            )}
            {totals.subtotalSpaces > 0 && (
              <Row label="Total Salones" value={fmtUsd(totals.subtotalSpaces)} />
            )}
          </div>

          {totals.discountAmount > 0 && (
            <div className="mt-1 flex items-baseline justify-between font-medium text-emerald-700">
              <span>Descuento de gerencia ({fmtPct(totals.discountPct)})</span>
              <span className="tabular-nums">−{fmtUsd(totals.discountAmount)}</span>
            </div>
          )}

          {/* Sub Total USD — base del IVA (Misceláneos + AyB + Salones, ya con descuento) */}
          {totals.taxableBase > 0 && (
            <div className="mt-1.5 flex items-baseline justify-between bg-sky-50 px-2 py-1 font-semibold text-sky-950">
              <span>Sub Total USD</span>
              <span className="tabular-nums">{fmtUsd(totals.taxableBase)}</span>
            </div>
          )}

          <div className="space-y-1.5 pt-1.5">
            {totals.subtotalTransfers > 0 && (
              <Row label="Traslados — Exento de IVA" value={fmtUsd(totals.subtotalTransfers)} />
            )}
            {params.serviceEnabled && totals.serviceAmount > 0 && (
              <Row
                label={`Total ${fmtPct(params.servicePct)} de servicio`}
                value={fmtUsd(totals.serviceAmount)}
              />
            )}
            {params.taxEnabled && (
              <Row label={`${fmtPct(params.taxPct)} IVA`} value={fmtUsd(totals.taxAmount)} />
            )}
          </div>

          {/* Cierre: Total USD → Garantía → TOTAL (la garantía se suma al TOTAL) */}
          {params.depositEnabled && totals.depositAmount > 0 ? (
            <>
              <div className="mt-1.5 flex items-baseline justify-between bg-sky-900 px-2 py-1.5 font-bold text-white">
                <span>Total USD</span>
                <span className="tabular-nums">{fmtUsd(totals.totalUsd)}</span>
              </div>
              <div className="pt-1.5">
                <Row
                  label={`Garantía ${fmtPct(params.depositPct)}`}
                  value={fmtUsd(totals.depositAmount)}
                />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between bg-sky-950 px-2 py-2 text-base font-bold text-white">
                <span>TOTAL</span>
                <span className="tabular-nums">{fmtUsd(totals.totalWithDeposit)}</span>
              </div>
              <p className="mt-1 text-right text-[10px] leading-snug text-zinc-400">
                La garantía es un depósito reembolsable que se devuelve al finalizar el evento sin
                novedades.
              </p>
            </>
          ) : (
            <div className="mt-1.5 flex items-baseline justify-between bg-sky-950 px-2 py-2 text-base font-bold text-white">
              <span>TOTAL</span>
              <span className="tabular-nums">{fmtUsd(totals.totalUsd)}</span>
            </div>
          )}

          {params.igtfEnabled && totals.igtfAmount > 0 && (
            <p className="pt-1 text-right text-[11px] text-zinc-400">
              Si paga en divisas aplica IGTF {fmtPct(params.igtfPct)}: +{fmtUsd(totals.igtfAmount)}
            </p>
          )}
        </div>
      </section>

      {/* ── Condiciones legales ────────────────────────────────── */}
      {legalItems.length > 0 && (
        <section className="mt-8 break-inside-avoid-page">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            Condiciones importantes
          </h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-zinc-600">
            {legalItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Firma ──────────────────────────────────────────────── */}
      <footer className="mt-10 break-inside-avoid-page border-t border-zinc-200 pt-5">
        <p className="text-sm font-semibold">{props.signerName}</p>
        <p className="text-xs text-zinc-500">Ejecutivo comercial · {hotel.name}</p>
        {props.signerEmail && <p className="text-xs text-zinc-500">{props.signerEmail}</p>}
        <p className="mt-4 text-center text-[10px] text-zinc-400">
          Precios expresados en dólares americanos (USD). La factura fiscal se emite en bolívares a
          la tasa oficial BCV del día de la operación.
        </p>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
