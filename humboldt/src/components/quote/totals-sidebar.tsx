"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtBs, fmtPct, usdToBs } from "@/lib/money";
import type { QuoteTotals, QuoteParams } from "@/lib/quote-calc";
import { ShieldCheck, Landmark, TrendingUp, BadgePercent } from "lucide-react";

/** Normaliza el texto del input de % a un número 0–100. */
function parsePct(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 100);
}

interface Props {
  totals: QuoteTotals;
  params: QuoteParams;
  canViewCosts: boolean;
  bcvRate: number | null;
  parallelRate?: number | null;
  rateKind?: "OFICIAL" | "PARALELA";
  onRateKindChange?: (k: "OFICIAL" | "PARALELA") => void;
  minMarginPct?: number;
  /** Descuento de gerencia: solo se muestra el control si es true (ADMIN/GERENTE). */
  canApplyDiscount?: boolean;
  discountPct?: number;
  discountReason?: string;
  onDiscountChange?: (pct: number, reason: string) => void;
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
export function TotalsSidebar({
  totals,
  params,
  canViewCosts,
  bcvRate,
  parallelRate = null,
  rateKind = "OFICIAL",
  onRateKindChange,
  minMarginPct = 20,
  canApplyDiscount = false,
  discountPct = 0,
  discountReason = "",
  onDiscountChange,
}: Props) {
  const activeRate = rateKind === "PARALELA" ? parallelRate : bcvRate;
  const showSelector = Boolean(onRateKindChange) && parallelRate != null;
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
          {totals.discountAmount > 0 && (
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-emerald-700 dark:text-emerald-400">
                Descuento gerencia ({fmtPct(totals.discountPct)})
              </span>
              <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                −{fmtUsd(totals.discountAmount)}
              </span>
            </div>
          )}
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
          {canApplyDiscount && (
            <div className="mt-1 space-y-2 rounded-md border border-dashed border-violet-300 bg-violet-50/50 p-2.5 dark:border-violet-800 dark:bg-violet-950/20">
              <div className="flex items-center gap-1.5 text-xs font-medium text-violet-900 dark:text-violet-200">
                <BadgePercent className="h-3.5 w-3.5" />
                Descuento de gerencia
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-20 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={discountPct || ""}
                    onChange={(e) => onDiscountChange?.(parsePct(e.target.value), discountReason)}
                    className="h-7 pr-5 text-sm"
                    aria-label="Porcentaje de descuento de gerencia"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
                <Input
                  value={discountReason}
                  onChange={(e) => onDiscountChange?.(discountPct, e.target.value)}
                  placeholder="Motivo (obligatorio)"
                  className="h-7 flex-1 text-sm"
                  aria-label="Motivo del descuento"
                />
              </div>
              {discountPct > 0 && !discountReason.trim() && (
                <p className="text-[11px] text-rose-600">Indicá el motivo del descuento.</p>
              )}
            </div>
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
          {(bcvRate || parallelRate || showSelector) && (
            <div className="mt-1 space-y-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
              {showSelector && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tasa para Bs</span>
                  <Select
                    value={rateKind}
                    onValueChange={(v) => onRateKindChange?.(v as "OFICIAL" | "PARALELA")}
                  >
                    <SelectTrigger className="h-6 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OFICIAL">BCV</SelectItem>
                      <SelectItem value="PARALELA">Paralela</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {activeRate != null && activeRate > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Landmark className="h-3 w-3" />
                    Equivale a
                  </span>
                  <span className="text-right">
                    <span className="font-semibold tabular-nums">
                      {fmtBs(usdToBs(totals.totalUsd, activeRate))}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      tasa {rateKind === "PARALELA" ? "paralela" : "BCV"}: {fmtBs(activeRate)}/USD
                    </span>
                  </span>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Sin tasa {rateKind === "PARALELA" ? "paralela" : "BCV"} disponible.
                </p>
              )}
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
