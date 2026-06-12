"use client";

// Acciones sobre la garantía en custodia: devolución (REINTEGRO negativo)
// o aplicación al saldo del evento.

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, Undo2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtUsd } from "@/lib/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { format } from "date-fns";
import { registrarMovimientoGarantia } from "../actions";

export function GarantiaActions({
  opportunityId,
  quoteId,
  disponible,
  saldo,
}: {
  opportunityId: string;
  quoteId: string | null;
  disponible: number;
  saldo: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <GarantiaDialog
        mode="DEVOLUCION"
        opportunityId={opportunityId}
        quoteId={quoteId}
        disponible={disponible}
        defaultAmount={disponible}
        trigger={
          <Button variant="outline" size="sm" disabled={disponible <= 0.01}>
            <Undo2 className="size-3.5" />
            Registrar devolución
          </Button>
        }
      />
      <GarantiaDialog
        mode="APLICACION"
        opportunityId={opportunityId}
        quoteId={quoteId}
        disponible={disponible}
        defaultAmount={Math.min(disponible, Math.max(saldo, 0)) || disponible}
        trigger={
          <Button variant="outline" size="sm" disabled={disponible <= 0.01}>
            <ShieldCheck className="size-3.5" />
            Aplicar al saldo
          </Button>
        }
      />
    </div>
  );
}

function GarantiaDialog({
  mode,
  opportunityId,
  quoteId,
  disponible,
  defaultAmount,
  trigger,
}: {
  mode: "DEVOLUCION" | "APLICACION";
  opportunityId: string;
  quoteId: string | null;
  disponible: number;
  defaultAmount: number;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const esDevolucion = mode === "DEVOLUCION";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {esDevolucion ? "Devolver garantía" : "Aplicar garantía al saldo"}
          </DialogTitle>
          <DialogDescription>
            {esDevolucion
              ? "Se registrará un reintegro (salida) por el monto devuelto al cliente."
              : "La garantía deja la custodia y se abona al saldo pendiente del evento."}{" "}
            En custodia: <span className="font-medium">{fmtUsd(disponible)}</span>.
          </DialogDescription>
        </DialogHeader>
        <GarantiaForm
          mode={mode}
          opportunityId={opportunityId}
          quoteId={quoteId}
          disponible={disponible}
          defaultAmount={defaultAmount}
          close={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function GarantiaForm({
  mode,
  opportunityId,
  quoteId,
  disponible,
  defaultAmount,
  close,
}: {
  mode: "DEVOLUCION" | "APLICACION";
  opportunityId: string;
  quoteId: string | null;
  disponible: number;
  defaultAmount: number;
  close: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const [monto, setMonto] = React.useState(defaultAmount > 0 ? String(defaultAmount) : "");
  const [metodo, setMetodo] = React.useState("TRANSFERENCIA");
  const [fecha, setFecha] = React.useState(() => format(new Date(), "yyyy-MM-dd"));
  const [referencia, setReferencia] = React.useState("");
  const [notas, setNotas] = React.useState("");

  const montoNum = parseFloat(monto.replace(",", ".")) || 0;
  const esDevolucion = mode === "DEVOLUCION";

  function submit() {
    if (montoNum <= 0) {
      toast.error("Indica un monto mayor a 0");
      return;
    }
    if (montoNum > disponible + 0.01) {
      toast.error(`Solo hay ${fmtUsd(disponible)} de garantía en custodia`);
      return;
    }
    startTransition(async () => {
      const res = await registrarMovimientoGarantia({
        opportunityId,
        quoteId,
        mode,
        amount: montoNum,
        method: metodo,
        date: fecha,
        reference: referencia || null,
        notes: notas || null,
      });
      if (res.ok) {
        toast.success(
          esDevolucion
            ? "Devolución de garantía registrada"
            : "Garantía aplicada al saldo del evento"
        );
        close();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Monto USD</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="grid gap-1.5">
              <Label>Referencia</Label>
              <Input
                placeholder="Nº de operación"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Notas</Label>
            <Textarea
              rows={2}
              placeholder="Observaciones…"
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
          {pending
            ? "Registrando…"
            : esDevolucion
              ? "Registrar devolución"
              : "Aplicar al saldo"}
        </Button>
      </DialogFooter>
    </>
  );
}
