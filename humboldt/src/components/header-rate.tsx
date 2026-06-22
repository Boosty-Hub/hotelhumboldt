"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CircleDollarSign, History, Loader2, PencilLine, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { fmtBs } from "@/lib/money";
import { refreshBcvRateAction, setManualRateAction } from "@/app/(app)/configuracion/actions";

export interface HeaderRateInfo {
  rate: number;
  date: Date;
  source: string; // BCV | MANUAL | CACHE
}

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  BCV: { label: "BCV", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  MANUAL: { label: "Manual", className: "bg-amber-100 text-amber-800 border-amber-200" },
  CACHE: { label: "Última guardada", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
};

interface HeaderRateProps {
  rate: HeaderRateInfo | null;
  canEdit: boolean;
}

/** Tasa de cambio vigente en el header. Clic → modal con detalle y (solo ADMIN) acciones. */
export function HeaderRate({ rate, canEdit }: HeaderRateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manualRate, setManualRate] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const [saving, startSave] = useTransition();
  const pending = refreshing || saving;

  const badge = rate ? SOURCE_BADGES[rate.source] ?? SOURCE_BADGES.CACHE : null;

  function handleRefresh() {
    startRefresh(async () => {
      const res = await refreshBcvRateAction();
      if (res.ok) {
        toast.success(res.message ?? "Tasa actualizada.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    startSave(async () => {
      const res = await setManualRateAction({ rate: manualRate });
      if (res.ok) {
        toast.success(res.message ?? "Tasa manual registrada.");
        setManualRate("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        title="Tasa de cambio — clic para ver el detalle"
        aria-label="Ver tasa de cambio"
      >
        <CircleDollarSign data-icon="inline-start" className="text-emerald-600" />
        <span className="font-medium tabular-nums">{rate ? fmtBs(rate.rate) : "Sin tasa"}</span>
        {rate && <span className="hidden text-muted-foreground sm:inline">/ USD</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tasa de cambio</DialogTitle>
            <DialogDescription>
              Las cotizaciones se expresan en USD; la factura legal se emite en bolívares a esta
              tasa.
            </DialogDescription>
          </DialogHeader>

          {rate ? (
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight tabular-nums">{fmtBs(rate.rate)}</p>
                <span className="text-sm text-muted-foreground">por USD</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {badge && (
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {format(new Date(rate.date), "dd/MM/yyyy, h:mm a", { locale: es })}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              No hay tasa registrada todavía. Consulta el BCV o registra una manual.
            </p>
          )}

          {canEdit && (
            <div className="space-y-3 border-t pt-3">
              <Button
                onClick={handleRefresh}
                disabled={pending}
                variant="outline"
                className="w-full"
              >
                {refreshing ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Actualizar desde BCV
              </Button>

              <form onSubmit={handleManualSave} className="space-y-1.5">
                <Label htmlFor="header-manual-rate">Registrar tasa manual</Label>
                <div className="flex items-stretch gap-2">
                  <InputGroup className="flex-1">
                    <InputGroupAddon>
                      <InputGroupText>Bs.</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="header-manual-rate"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      placeholder="0,00"
                      value={manualRate}
                      onChange={(e) => setManualRate(e.target.value)}
                      disabled={pending}
                      className="text-right tabular-nums"
                    />
                  </InputGroup>
                  <Button type="submit" disabled={pending || !manualRate}>
                    {saving ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <PencilLine data-icon="inline-start" />
                    )}
                    Guardar
                  </Button>
                </div>
              </form>
            </div>
          )}

          <Button asChild variant="ghost" className="justify-start">
            <Link href="/configuracion/tasa" onClick={() => setOpen(false)}>
              <History data-icon="inline-start" />
              Ver historial completo
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
