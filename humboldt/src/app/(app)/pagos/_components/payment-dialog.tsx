"use client";

// Diálogo "Registrar pago" — soporta USD y Bs (con tasa BCV editable),
// asociación a cuota e imputación opcional por secciones.
// El estado del formulario vive en un componente interno que se monta al
// abrir el diálogo (Radix desmonta el contenido al cerrar → reset natural).

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRightLeft } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtUsd, fmtBs, bsToUsd, round2 } from "@/lib/money";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
} from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { registrarPago } from "../actions";
import {
  ALLOCATION_BUCKETS,
  ALLOCATION_BUCKET_LABELS,
  type TargetOption,
} from "../types";
import { TargetCombobox } from "./target-combobox";

interface AllocationRow {
  bucket: string;
  amount: string;
}

export interface BankAccountOption {
  id: string;
  name: string;
  currency: string;
  type: string;
}

export function PaymentDialog({
  targets,
  defaultRate,
  trigger,
  open: controlledOpen,
  onOpenChange,
  presetTargetValue,
  bankAccounts = [],
}: {
  targets: TargetOption[];
  defaultRate: number | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  presetTargetValue?: string | null;
  bankAccounts?: BankAccountOption[];
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Registra abonos, anticipos, garantías o reintegros. Los pagos en bolívares se
            convierten a USD con la tasa BCV.
          </DialogDescription>
        </DialogHeader>
        <PaymentForm
          targets={targets}
          defaultRate={defaultRate}
          presetTargetValue={presetTargetValue ?? null}
          bankAccounts={bankAccounts}
          close={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  targets,
  defaultRate,
  presetTargetValue,
  bankAccounts,
  close,
}: {
  targets: TargetOption[];
  defaultRate: number | null;
  presetTargetValue: string | null;
  bankAccounts: BankAccountOption[];
  close: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const [target, setTarget] = React.useState<string | null>(presetTargetValue);
  const [tipo, setTipo] = React.useState<string>("ABONO");
  const [metodo, setMetodo] = React.useState<string>("ZELLE");
  const [moneda, setMoneda] = React.useState<"USD" | "BS">("USD");
  const [monto, setMonto] = React.useState("");
  const [tasa, setTasa] = React.useState(defaultRate ? String(defaultRate) : "");
  const [fecha, setFecha] = React.useState(() => format(new Date(), "yyyy-MM-dd"));
  const [referencia, setReferencia] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [cuotaId, setCuotaId] = React.useState<string>("none");
  const [bankAccountId, setBankAccountId] = React.useState<string>("none");
  const [imputar, setImputar] = React.useState(false);
  const [allocs, setAllocs] = React.useState<AllocationRow[]>([]);

  // Cuentas de la misma moneda del pago (Bs→cuentas Bs, USD→cuentas USD).
  const cuentasMoneda = bankAccounts.filter((b) => b.currency === moneda);

  const selected = targets.find((t) => t.value === target) ?? null;
  const cuotasPendientes = (selected?.installments ?? []).filter(
    (i) => i.status !== "PAGADA"
  );

  const montoNum = parseFloat(monto.replace(",", ".")) || 0;
  const tasaNum = parseFloat(tasa.replace(",", ".")) || 0;
  const equivalenteUsd =
    moneda === "BS" ? bsToUsd(montoNum, tasaNum) : round2(montoNum);

  // La imputación se ingresa en la MONEDA del pago (Bs o USD) y debe sumar el
  // monto del pago en esa moneda; al guardar se convierte cada sección a USD.
  const allocSum = round2(
    allocs.reduce((s, a) => s + (parseFloat(a.amount.replace(",", ".")) || 0), 0)
  );
  const allocOk =
    !imputar || allocs.length === 0 || Math.abs(allocSum - montoNum) <= 0.01;

  function handleMonedaChange(value: "USD" | "BS") {
    setMoneda(value);
    setBankAccountId("none"); // las cuentas se filtran por moneda
    if (value === "BS" && !tasa && defaultRate) setTasa(String(defaultRate));
  }

  function submit() {
    if (!selected) {
      toast.error("Selecciona una cotización u oportunidad");
      return;
    }
    if (montoNum <= 0) {
      toast.error("Indica un monto mayor a 0");
      return;
    }
    if (moneda === "BS" && tasaNum <= 0) {
      toast.error("Indica la tasa Bs/USD");
      return;
    }
    if (imputar && allocs.length > 0 && !allocOk) {
      const f = (n: number) => (moneda === "BS" ? fmtBs(n) : fmtUsd(n));
      toast.error(
        `La imputación (${f(allocSum)}) debe sumar el monto del pago (${f(montoNum)})`
      );
      return;
    }

    // Imputaciones convertidas a USD (la acción trabaja en USD). La última
    // sección absorbe el redondeo para que el total cuadre exacto con el
    // equivalente en USD del pago.
    let usdAllocations: { bucket: string; amount: number }[] | null = null;
    if (imputar && allocs.length > 0) {
      const rows = allocs.map((a) => {
        const orig = parseFloat(a.amount.replace(",", ".")) || 0;
        return {
          bucket: a.bucket,
          amount: moneda === "BS" ? bsToUsd(orig, tasaNum) : round2(orig),
        };
      });
      const sum = round2(rows.reduce((s, r) => s + r.amount, 0));
      const diff = round2(equivalenteUsd - sum);
      if (rows.length > 0 && Math.abs(diff) >= 0.01) {
        rows[rows.length - 1].amount = round2(rows[rows.length - 1].amount + diff);
      }
      usdAllocations = rows;
    }

    startTransition(async () => {
      const res = await registrarPago({
        opportunityId: selected.opportunityId,
        quoteId: selected.quoteId,
        installmentId: cuotaId !== "none" ? cuotaId : null,
        type: tipo,
        method: metodo,
        currency: moneda,
        amount: montoNum,
        rate: moneda === "BS" ? tasaNum : null,
        date: fecha,
        reference: referencia || null,
        notes: notas || null,
        bankAccountId: bankAccountId !== "none" ? bankAccountId : null,
        allocations: usdAllocations,
      });
      if (res.ok) {
        toast.success("Pago registrado correctamente");
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
            onChange={(v) => {
              setTarget(v);
              setCuotaId("none");
            }}
            disabled={Boolean(presetTargetValue)}
          />
          {selected?.totalUsd != null && (
            <p className="text-[11px] text-muted-foreground">
              Total de la cotización:{" "}
              <span className="font-medium">{fmtUsd(selected.totalUsd)}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PAYMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tipo === "REINTEGRO" && (
              <p className="text-[11px] text-amber-700">
                El reintegro se registra como salida (monto negativo).
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Método</Label>
            <Select value={metodo} onValueChange={setMetodo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Moneda</Label>
            <Select
              value={moneda}
              onValueChange={(v) => handleMonedaChange(v as "USD" | "BS")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">Dólares (USD)</SelectItem>
                <SelectItem value="BS">Bolívares (Bs)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{moneda === "BS" ? "Monto en Bs" : "Monto en USD"}</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
        </div>

        {moneda === "BS" && (
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Tasa Bs/USD</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.0001"
                placeholder="Tasa BCV"
                value={tasa}
                onChange={(e) => setTasa(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {defaultRate
                  ? `Tasa BCV del día: ${defaultRate}`
                  : "Sin tasa BCV disponible — indícala manualmente"}
              </p>
            </div>
            <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm">
              <ArrowRightLeft className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Equivale a</span>
              <span className="font-semibold tabular-nums">{fmtUsd(equivalenteUsd)}</span>
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>¿A qué cuenta entró? (conciliación)</Label>
          <Select value={bankAccountId} onValueChange={setBankAccountId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Cuenta de recepción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin especificar</SelectItem>
              {cuentasMoneda.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {bankAccounts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Configurá cuentas en el módulo Bancos para poder conciliar.
            </p>
          ) : cuentasMoneda.length === 0 ? (
            <p className="text-[11px] text-amber-700">
              No hay cuentas en {moneda}. Creá una en Bancos.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Referencia</Label>
            <Input
              placeholder="Nº de transferencia / Zelle"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
        </div>

        {selected?.kind === "QUOTE" && cuotasPendientes.length > 0 && (
          <div className="grid gap-1.5">
            <Label>Aplicar a cuota (opcional)</Label>
            <Select value={cuotaId} onValueChange={setCuotaId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cuota específica</SelectItem>
                {cuotasPendientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label} · vence{" "}
                    {format(new Date(c.dueDate), "dd/MM/yyyy", { locale: es })} ·{" "}
                    {fmtUsd(c.amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selected?.kind === "QUOTE" && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Imputar por secciones</Label>
                <p className="text-[11px] text-muted-foreground">
                  Desglosa el pago entre Misceláneos, Traslados, AyB, Espacios o Garantía.
                  Si no, se registra como General.
                </p>
              </div>
              <Switch
                checked={imputar}
                onCheckedChange={(v) => {
                  setImputar(v);
                  if (v && allocs.length === 0) {
                    setAllocs([{ bucket: "ALIMENTOS_BEBIDAS", amount: monto || "" }]);
                  }
                }}
              />
            </div>

            {imputar && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                {allocs.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={a.bucket}
                      onValueChange={(v) =>
                        setAllocs((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, bucket: v } : r))
                        )
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALLOCATION_BUCKETS.map((b) => (
                          <SelectItem key={b} value={b}>
                            {ALLOCATION_BUCKET_LABELS[b]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="w-32"
                      placeholder={`Monto ${moneda === "BS" ? "Bs" : "USD"}`}
                      value={a.amount}
                      onChange={(e) =>
                        setAllocs((rows) =>
                          rows.map((r, i) =>
                            i === idx ? { ...r, amount: e.target.value } : r
                          )
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setAllocs((rows) => rows.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAllocs((rows) => [...rows, { bucket: "MISCELANEOS", amount: "" }])
                    }
                  >
                    <Plus className="size-3.5" />
                    Agregar sección
                  </Button>
                  <p
                    className={
                      allocOk
                        ? "text-[11px] text-muted-foreground"
                        : "text-[11px] font-medium text-rose-600"
                    }
                  >
                    Imputado: {moneda === "BS" ? fmtBs(allocSum) : fmtUsd(allocSum)} /{" "}
                    {moneda === "BS" ? fmtBs(montoNum) : fmtUsd(montoNum)}
                    {moneda === "BS" && (
                      <span className="ml-1 text-muted-foreground">
                        (≈ {fmtUsd(equivalenteUsd)})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        <div className="grid gap-1.5">
          <Label>Notas</Label>
          <Textarea
            rows={2}
            placeholder="Observaciones del pago…"
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
          {pending ? "Registrando…" : "Registrar pago"}
        </Button>
      </DialogFooter>
    </>
  );
}
