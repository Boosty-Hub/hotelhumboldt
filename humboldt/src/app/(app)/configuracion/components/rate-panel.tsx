"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CircleDollarSign, Loader2, PencilLine, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { fmtBs } from "@/lib/money";
import { refreshBcvRateAction, setManualRateAction } from "../actions";
import type { RateInfo } from "../types";

const RATE_SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  BCV: { label: "BCV", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  MANUAL: { label: "Manual", className: "bg-amber-100 text-amber-800 border-amber-200" },
  CACHE: { label: "Última guardada", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
};

interface RatePanelProps {
  rate: RateInfo | null;
}

/** Tasa de cambio: tasa vigente, actualización desde BCV y registro manual. */
export function RatePanel({ rate }: RatePanelProps) {
  const [manualRate, setManualRate] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const [saving, startSave] = useTransition();
  const pending = refreshing || saving;

  function handleRefresh() {
    startRefresh(async () => {
      const res = await refreshBcvRateAction();
      if (res.ok) toast.success(res.message ?? "Tasa actualizada.");
      else toast.error(res.error);
    });
  }

  function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    startSave(async () => {
      const res = await setManualRateAction({ rate: manualRate });
      if (res.ok) {
        toast.success(res.message ?? "Tasa manual registrada.");
        setManualRate("");
      } else {
        toast.error(res.error);
      }
    });
  }

  const sourceBadge = rate ? RATE_SOURCE_BADGES[rate.source] ?? RATE_SOURCE_BADGES.CACHE : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Tasa vigente */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Tasa de cambio vigente</CardTitle>
          <CardDescription>
            Las cotizaciones se expresan en USD; la factura legal se emite en bolívares a esta
            tasa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rate ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-bold tracking-tight tabular-nums">
                    {fmtBs(rate.rate)}
                  </p>
                  <span className="text-sm text-muted-foreground">por USD</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {sourceBadge && (
                    <Badge variant="outline" className={sourceBadge.className}>
                      {sourceBadge.label}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(rate.date, "dd/MM/yyyy, h:mm a", { locale: es })}
                  </span>
                </div>
              </div>
              <Button onClick={handleRefresh} disabled={pending} variant="outline">
                {refreshing ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Actualizar desde BCV
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CircleDollarSign className="size-10 text-muted-foreground/60" />
              <div>
                <p className="text-sm font-medium">Sin tasa registrada</p>
                <p className="text-xs text-muted-foreground">
                  Consulta el BCV o registra una tasa manual para empezar.
                </p>
              </div>
              <Button onClick={handleRefresh} disabled={pending}>
                {refreshing ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Consultar BCV ahora
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasa manual */}
      <Card>
        <CardHeader>
          <CardTitle>Registrar tasa manual</CardTitle>
          <CardDescription>
            Úsala si el BCV no está disponible o para fijar una tasa puntual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-rate">Bolívares por USD</Label>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>Bs.</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="manual-rate"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  placeholder="0,00"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  disabled={pending}
                  required
                  className="text-right tabular-nums"
                />
              </InputGroup>
            </div>
            <Button type="submit" disabled={pending || !manualRate} className="w-full">
              {saving ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <PencilLine data-icon="inline-start" />
              )}
              Guardar tasa manual
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
