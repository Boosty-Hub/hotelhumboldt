"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, AlertTriangle } from "lucide-react";
import { fmtUsd, fmtPct } from "@/lib/money";
import { SECTION_LABELS } from "@/lib/constants";
import type { CostAnalysis } from "@/lib/quote-calc";
import { cn } from "@/lib/utils";

const PRINT_CSS = `@media print { .print-hidden { display: none !important; } @page { margin: 14mm; } body { background: white !important; } }`;

interface Props {
  quoteId: string;
  number: string;
  version: number;
  status: string;
  clientName: string;
  clientLegal: string;
  eventName: string | null;
  eventPax: number | null;
  signerName: string;
  analysis: CostAnalysis;
  minMarginPct: number;
}

/** Color del margen: rojo si está por debajo del mínimo, verde si cumple. */
function marginClass(pct: number | null, min: number): string {
  if (pct == null) return "text-zinc-400";
  return pct < min ? "font-semibold text-rose-600" : "text-emerald-700";
}

export function CostReport(props: Props) {
  const a = props.analysis;

  return (
    <div className="min-h-screen bg-zinc-100">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* Barra de acciones (no se imprime) */}
      <div className="print-hidden sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-6 py-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/cotizaciones/${props.quoteId}/editar`} aria-label="Volver al editor">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm font-semibold">Análisis de costos · {props.number}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/cotizaciones/${props.quoteId}/costos/export`} download>
              <Download className="h-3.5 w-3.5" />
              Excel
            </a>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl bg-white p-6 text-zinc-900 print:max-w-none print:p-0">
        {/* Encabezado */}
        <header className="border-b-2 border-sky-950 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-rose-600">
                Documento interno · No compartir con el cliente
              </p>
              <h1 className="mt-1 text-2xl font-bold text-sky-950">Análisis de costos</h1>
              <p className="text-sm text-zinc-600">
                Presupuesto {props.number}
                {props.version > 1 ? ` · v${props.version}` : ""} · {props.status}
              </p>
            </div>
            <div className="text-right text-xs text-zinc-600">
              <p className="font-semibold text-zinc-800">{props.clientName}</p>
              {props.clientLegal !== props.clientName && <p>{props.clientLegal}</p>}
              {props.eventName && <p>{props.eventName}</p>}
              {props.eventPax != null && <p>{props.eventPax} pax</p>}
              <p>Ejecutivo: {props.signerName}</p>
            </div>
          </div>
        </header>

        {a.linesWithoutCost > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {a.linesWithoutCost} ítem(s) con venta pero <b>sin costo cargado</b>: su margen figura
              como 100% y puede estar inflado. Cargá el costo en el catálogo para un análisis exacto.
            </span>
          </div>
        )}

        {/* Secciones */}
        <div className="mt-6 space-y-6">
          {a.sections.map((s) => (
            <section key={s.section} className="break-inside-avoid-page">
              <h2 className="mb-2 flex items-baseline justify-between border-b border-zinc-300 pb-1.5">
                <span className="text-sm font-bold uppercase tracking-wide text-sky-950">
                  {SECTION_LABELS[s.section]}
                </span>
                <span className={cn("text-xs", marginClass(s.marginPct, props.minMarginPct))}>
                  Margen {s.marginPct == null ? "—" : fmtPct(s.marginPct)}
                </span>
              </h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-400">
                    <th className="py-1 pr-2 font-medium">Descripción</th>
                    <th className="w-14 py-1 pr-2 text-right font-medium">Cant.</th>
                    <th className="w-20 py-1 pr-2 text-right font-medium">Costo u.</th>
                    <th className="w-20 py-1 pr-2 text-right font-medium">Costo</th>
                    <th className="w-20 py-1 pr-2 text-right font-medium">Venta</th>
                    <th className="w-20 py-1 pr-2 text-right font-medium">Ganancia</th>
                    <th className="w-16 py-1 text-right font-medium">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {s.lines.map((l, i) => (
                    <tr key={i} className={l.isOptional ? "text-zinc-400" : ""}>
                      <td className="py-1 pr-2 align-top">
                        {l.description}
                        {l.isOptional && <span className="ml-1 text-[10px]">(opcional)</span>}
                        {!l.hasCost && !l.isOptional && (
                          <span className="ml-1 text-[10px] text-amber-600">sin costo</span>
                        )}
                      </td>
                      <td className="py-1 pr-2 text-right align-top tabular-nums">
                        {l.isOptional ? "—" : l.quantity}
                      </td>
                      <td className="py-1 pr-2 text-right align-top tabular-nums">
                        {l.unitCost == null ? "—" : fmtUsd(l.unitCost)}
                      </td>
                      <td className="py-1 pr-2 text-right align-top tabular-nums">{fmtUsd(l.cost)}</td>
                      <td className="py-1 pr-2 text-right align-top tabular-nums">{fmtUsd(l.sale)}</td>
                      <td className="py-1 pr-2 text-right align-top tabular-nums">{fmtUsd(l.profit)}</td>
                      <td
                        className={cn(
                          "py-1 text-right align-top tabular-nums",
                          marginClass(l.marginPct, props.minMarginPct)
                        )}
                      >
                        {l.marginPct == null ? "—" : fmtPct(l.marginPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-300 font-semibold">
                    <td className="py-1 pr-2">Subtotal {SECTION_LABELS[s.section]}</td>
                    <td />
                    <td />
                    <td className="py-1 pr-2 text-right tabular-nums">{fmtUsd(s.cost)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{fmtUsd(s.sale)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{fmtUsd(s.profit)}</td>
                    <td
                      className={cn(
                        "py-1 text-right tabular-nums",
                        marginClass(s.marginPct, props.minMarginPct)
                      )}
                    >
                      {s.marginPct == null ? "—" : fmtPct(s.marginPct)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>
          ))}
          {a.sections.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">
              La cotización todavía no tiene ítems cargados.
            </p>
          )}
        </div>

        {/* Totales globales */}
        {a.sections.length > 0 && (
          <section className="mt-8 flex justify-end break-inside-avoid-page">
            <div className="w-full max-w-sm space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Costo total</span>
                <span className="font-medium tabular-nums">{fmtUsd(a.totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Venta total (sin IVA)</span>
                <span className="font-medium tabular-nums">{fmtUsd(a.totalSale)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-300 pt-1">
                <span className="font-semibold">Ganancia bruta</span>
                <span className="font-bold tabular-nums">{fmtUsd(a.grossMargin)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between rounded-md bg-sky-950 px-3 py-2 text-white">
                <span className="font-semibold">Margen global</span>
                <span
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    a.grossMarginPct < props.minMarginPct ? "text-rose-300" : "text-emerald-300"
                  )}
                >
                  {fmtPct(a.grossMarginPct)}
                </span>
              </div>
              {a.grossMarginPct < props.minMarginPct && a.totalCost > 0 && (
                <p className="rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                  ⚠ Margen por debajo del mínimo recomendado ({fmtPct(props.minMarginPct)}).
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
