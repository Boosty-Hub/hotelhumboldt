"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtBs, fmtPct, usdToBs } from "@/lib/money";
import type { QuoteTotals, QuoteParams } from "@/lib/quote-calc";
import { ShieldCheck, Landmark, TrendingUp } from "lucide-react";

interface Props {
  totals: QuoteTotals;
  params: QuoteParams;
  canViewCosts: boolean;
  bcvRate: number | null;
  minMarginPct?: number;
}

function Row({
  label,
  value,
  muted = true,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : "font-medium"}>{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** Totales EN VIVO del editor — siempre calculados con calcQuoteTotals. */
export function TotalsSidebar({ totals, params, canViewCosts, bcvRate, minMarginPct = 20 }: Props) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumen del presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="Misceláneos" value={fmtUsd(totals.subtotalMisc)} />
          <Row label="Alimentos y Bebidas" value={fmtUsd(totals.subtotalFood)} />
          <Row label="Espacios" value={fmtUsd(totals.subtotalSpaces)} />
          <Row label="Traslados (exento IVA)" value={fmtUsd(totals.subtotalTransfers)} />
          <Separator className="my-2" />
          {params.serviceEnabled && (
            <Row
              label={`Servicio ${fmtPct(params.servicePct)} (AyB)`}
              value={fmtUsd(totals.serviceAmount)}
            />
          )}
          {params.taxEnabled && (
            <Row label={`IVA ${fmtPct(params.taxPct)}`} value={fmtUsd(totals.taxAmount)} />
          )}
          <div className="mt-2 flex items-baseline justify-between rounded-lg bg-sky-950 px-3 py-2.5 text-white">
            <span className="text-sm font-semibold">Total USD</span>
            <span className="text-xl font-bold tabular-nums">{fmtUsd(totals.totalUsd)}</span>
          </div>
          {params.igtfEnabled && (
            <p className="text-right text-[11px] text-muted-foreground">
              Si paga en divisas: +{fmtUsd(totals.igtfAmount)} (IGTF {fmtPct(params.igtfPct)})
            </p>
          )}
          {bcvRate != null && bcvRate > 0 && (
            <div className="mt-1 flex items-center justify-between rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Landmark className="h-3 w-3" />
                Equivale a
              </span>
              <span className="text-right">
                <span className="font-semibold tabular-nums">
                  {fmtBs(usdToBs(totals.totalUsd, bcvRate))}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  tasa BCV del día: {fmtBs(bcvRate)}/USD
                </span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Garantía: SEPARADA del total — depósito reembolsable */}
      {params.depositEnabled && (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="space-y-1.5 pt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Garantía {fmtPct(params.depositPct)}
              </span>
              <span className="font-bold tabular-nums text-amber-900 dark:text-amber-200">
                {fmtUsd(totals.depositAmount)}
              </span>
            </div>
            <p className="text-[11px] leading-snug text-amber-800/90 dark:text-amber-300/80">
              Depósito reembolsable en resguardo por daños. No se suma al total del evento.
            </p>
            <Separator className="bg-amber-200" />
            <Row
              label="Total a movilizar"
              value={fmtUsd(totals.totalWithDeposit)}
              muted={false}
            />
          </CardContent>
        </Card>
      )}

      {/* Resumen interno de costos — SOLO roles con permiso */}
      {canViewCosts && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Interno — costos y margen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Row label="Costo total estimado" value={fmtUsd(totals.totalCost)} />
            <Row label="Margen bruto" value={fmtUsd(totals.grossMargin)} />
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Margen %</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  totals.grossMarginPct < minMarginPct ? "text-rose-600" : "text-emerald-700"
                )}
              >
                {fmtPct(totals.grossMarginPct)}
              </span>
            </div>
            {totals.grossMarginPct < minMarginPct && totals.totalCost > 0 && (
              <p className="rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                Margen por debajo del mínimo recomendado ({fmtPct(minMarginPct)}).
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
