"use client";

// Diálogo "Registrar factura" — fiscal/proforma/adicionales con retenciones.
// El formulario vive en un componente interno que se monta al abrir.

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtUsd, fmtBs, bsToUsd } from "@/lib/money";
import { format } from "date-fns";
import { registrarFactura } from "../actions";
import {
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
  RETENTION_TYPES,
  type TargetOption,
} from "../types";
import { TargetCombobox } from "./target-combobox";

interface RetRow {
  type: string;
  amountBs: string;
}

export function InvoiceDialog({
  targets,
  defaultRate,
  trigger,
  presetTargetValue,
}: {
  targets: TargetOption[];
  defaultRate: number | null;
  trigger: React.ReactNode;
  presetTargetValue?: string | null;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar factura</DialogTitle>
          <DialogDescription>
            La factura legal se emite en bolívares a tasa BCV. Las retenciones de IVA e
            ISLR cuentan como pago.
          </DialogDescription>
        </DialogHeader>
        <InvoiceForm
          targets={targets}
          defaultRate={defaultRate}
          presetTargetValue={presetTargetValue ?? null}
          close={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function InvoiceForm({
  targets,
  defaultRate,
  presetTargetValue,
  close,
}: {
  targets: TargetOption[];
  defaultRate: number | null;
  presetTargetValue: string | null;
  close: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const [target, setTarget] = React.useState<string | null>(presetTargetValue);
  const [numero, setNumero] = React.useState("");
  const [fecha, setFecha] = React.useState(() => format(new Date(), "yyyy-MM-dd"));
  const [tipo, setTipo] = React.useState<string>("FISCAL");
  const [montoBs, setMontoBs] = React.useState("");
  const [tasa, setTasa] = React.useState(defaultRate ? String(defaultRate) : "");
  const [notas, setNotas] = React.useState("");
  const [rets, setRets] = React.useState<RetRow[]>([]);

  const selected = targets.find((t) => t.value === target) ?? null;
  const montoNum = parseFloat(montoBs.replace(",", ".")) || 0;
  const tasaNum = parseFloat(tasa.replace(",", ".")) || 0;
  const usdRef = tasaNum > 0 ? bsToUsd(montoNum, tasaNum) : 0;

  function submit() {
    if (!selected) {
      toast.error("Selecciona una cotización u oportunidad");
      return;
    }
    if (!numero.trim()) {
      toast.error("Indica el número de factura");
      return;
    }
    if (montoNum <= 0) {
      toast.error("Indica el monto en bolívares");
      return;
    }
    if (tasaNum <= 0) {
      toast.error("Indica la tasa Bs/USD");
      return;
    }

    startTransition(async () => {
      const res = await registrarFactura({
        opportunityId: selected.opportunityId,
        quoteId: selected.quoteId,
        number: numero,
        date: fecha,
        type: tipo,
        amountBs: montoNum,
        rate: tasaNum,
        notes: notas || null,
        retentions: rets
          .filter((r) => (parseFloat(r.amountBs.replace(",", ".")) || 0) > 0)
          .map((r) => ({
            type: r.type,
            amountBs: parseFloat(r.amountBs.replace(",", ".")) || 0,
          })),
      });
      if (res.ok) {
        toast.success("Factura registrada correctamente");
        close();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>Cotización u oportunidad</Label>
          <TargetCombobox
            targets={targets}
            value={target}
            onChange={setTarget}
            disabled={Boolean(presetTargetValue)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label>Nº de factura</Label>
            <Input
              placeholder="00001234"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {INVOICE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Monto en Bs</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={montoBs}
              onChange={(e) => setMontoBs(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Tasa Bs/USD</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.0001"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
            />
          </div>
          <div className="flex h-9 items-center justify-center rounded-md border bg-muted/40 px-3 text-sm">
            <span className="mr-1.5 text-muted-foreground">Ref:</span>
            <span className="font-semibold tabular-nums">{fmtUsd(usdRef)}</span>
          </div>
        </div>
        {defaultRate && (
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Tasa BCV del día: {defaultRate}
          </p>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Retenciones (IVA / ISLR)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRets((r) => [...r, { type: "IVA", amountBs: "" }])}
            >
              <Plus className="size-3.5" />
              Agregar retención
            </Button>
          </div>
          {rets.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Sin retenciones registradas para esta factura.
            </p>
          ) : (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              {rets.map((r, idx) => {
                const bs = parseFloat(r.amountBs.replace(",", ".")) || 0;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={r.type}
                      onValueChange={(v) =>
                        setRets((rows) =>
                          rows.map((row, i) => (i === idx ? { ...row, type: v } : row))
                        )
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RETENTION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            Ret. {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="flex-1"
                      placeholder="Monto Bs"
                      value={r.amountBs}
                      onChange={(e) =>
                        setRets((rows) =>
                          rows.map((row, i) =>
                            i === idx ? { ...row, amountBs: e.target.value } : row
                          )
                        )
                      }
                    />
                    <span className="w-24 text-right text-[11px] tabular-nums text-muted-foreground">
                      {tasaNum > 0 && bs > 0 ? `≈ ${fmtUsd(bsToUsd(bs, tasaNum))}` : "—"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setRets((rows) => rows.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
              <p className="pt-1 text-right text-[11px] text-muted-foreground">
                Total retenido:{" "}
                {fmtBs(
                  rets.reduce(
                    (s, r) => s + (parseFloat(r.amountBs.replace(",", ".")) || 0),
                    0
                  )
                )}
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label>Notas</Label>
          <Textarea
            rows={2}
            placeholder="Observaciones de la factura…"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={close}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Registrando…" : "Registrar factura"}
        </Button>
      </DialogFooter>
    </>
  );
}
