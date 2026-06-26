"use client";

// Sheet "Plan de cuotas" — lista, generador rápido (N cuotas con %),
// edición de fechas/montos y asociación de pagos a cuotas.
// El estado vive en un componente interno montado al abrir el sheet.

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, Link2, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtUsd, round2 } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addDays, format } from "date-fns";
import { asociarPagoACuota, eliminarCuota, guardarPlanCuotas } from "../actions";
import {
  INSTALLMENT_STATUS_COLORS,
  INSTALLMENT_STATUS_LABELS,
  type CxcRow,
} from "../types";

interface EditRow {
  id: string | null;
  label: string;
  dueDate: string; // yyyy-MM-dd
  amount: string;
  locked: boolean; // tiene pagos asociados
  paidUsd: number;
  status: string;
}

function displayStatus(status: string, dueDate: string, paid: boolean): string {
  if (status === "PAGADA" || paid) return "PAGADA";
  const due = new Date(`${dueDate}T23:59:59`);
  if (due < new Date()) return "VENCIDA";
  return status;
}

export function InstallmentsSheet({
  row,
  open,
  onOpenChange,
}: {
  row: CxcRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg! gap-0 overflow-hidden p-0">
        {row && <PlanForm row={row} close={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function PlanForm({ row, close }: { row: CxcRow; close: () => void }) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = React.useState<EditRow[]>(() =>
    row.installments.map((i) => ({
      id: i.id,
      label: i.label,
      dueDate: format(new Date(i.dueDate), "yyyy-MM-dd"),
      amount: String(i.amount),
      locked: i.paidUsd > 0,
      paidUsd: i.paidUsd,
      status: i.status,
    }))
  );
  const [pcts, setPcts] = React.useState("30/40/30");
  const [firstDate, setFirstDate] = React.useState(() => format(new Date(), "yyyy-MM-dd"));
  const [confirmDelete, setConfirmDelete] = React.useState<number | null>(null);

  const total = row.totalUsd;
  const sumPlan = round2(
    rows.reduce((s, r) => s + (parseFloat(r.amount.replace(",", ".")) || 0), 0)
  );
  const planMatches = Math.abs(sumPlan - total) <= 0.01;

  function generarPlan() {
    const parts = pcts
      .split("/")
      .map((p) => parseFloat(p.trim().replace(",", ".")))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (parts.length === 0) {
      toast.error("Indica los porcentajes separados por «/», por ejemplo 30/40/30");
      return;
    }
    const sumPct = round2(parts.reduce((s, n) => s + n, 0));
    if (Math.abs(sumPct - 100) > 0.01) {
      toast.error(`Los porcentajes suman ${sumPct}% — deben sumar 100%`);
      return;
    }
    const locked = rows.filter((r) => r.locked);
    const base = new Date(`${firstDate}T12:00:00`);
    const generated: EditRow[] = [];
    let acc = 0;
    parts.forEach((pct, i) => {
      const isLast = i === parts.length - 1;
      const amount = isLast ? round2(total - acc) : round2((total * pct) / 100);
      acc = round2(acc + amount);
      generated.push({
        id: null,
        label:
          i === 0
            ? `Reserva ${pct}%`
            : isLast
              ? `Saldo final ${pct}%`
              : `Abono ${i + 1} (${pct}%)`,
        dueDate: format(addDays(base, i * 30), "yyyy-MM-dd"),
        amount: String(amount),
        locked: false,
        paidUsd: 0,
        status: "PENDIENTE",
      });
    });
    setRows([...locked, ...generated]);
    toast.info("Plan generado — revisa fechas y montos antes de guardar");
  }

  function agregarCuota() {
    setRows((r) => [
      ...r,
      {
        id: null,
        label: `Abono ${r.length + 1}`,
        dueDate: format(new Date(), "yyyy-MM-dd"),
        amount: "",
        locked: false,
        paidUsd: 0,
        status: "PENDIENTE",
      },
    ]);
  }

  function quitarCuota(idx: number) {
    const r = rows[idx];
    if (r.id) {
      setConfirmDelete(idx); // cuota persistida → confirmar
    } else {
      setRows((rs) => rs.filter((_, i) => i !== idx));
    }
  }

  function confirmarEliminar() {
    if (confirmDelete === null) return;
    const r = rows[confirmDelete];
    if (!r?.id) return;
    startTransition(async () => {
      const res = await eliminarCuota(r.id as string);
      if (res.ok) {
        toast.success("Cuota eliminada");
        setRows((rs) => rs.filter((_, i) => i !== confirmDelete));
      } else {
        toast.error(res.error);
      }
      setConfirmDelete(null);
    });
  }

  function guardar() {
    if (rows.length === 0) {
      toast.error("Agrega al menos una cuota o genera un plan");
      return;
    }
    for (const r of rows) {
      if (!r.label.trim()) {
        toast.error("Cada cuota necesita una descripción");
        return;
      }
      if ((parseFloat(r.amount.replace(",", ".")) || 0) <= 0) {
        toast.error(`La cuota "${r.label}" necesita un monto mayor a 0`);
        return;
      }
    }
    startTransition(async () => {
      const res = await guardarPlanCuotas({
        quoteId: row.quoteId,
        cuotas: rows.map((r) => ({
          id: r.id,
          label: r.label,
          dueDate: r.dueDate,
          amount: parseFloat(r.amount.replace(",", ".")) || 0,
        })),
      });
      if (res.ok) {
        toast.success("Plan de cuotas guardado");
        close();
      } else {
        toast.error(res.error);
      }
    });
  }

  function asociar(paymentId: string, installmentId: string) {
    startTransition(async () => {
      const res = await asociarPagoACuota(paymentId, installmentId);
      if (res.ok) toast.success("Pago asociado a la cuota");
      else toast.error(res.error);
    });
  }

  return (
    <>
      <SheetHeader className="border-b px-5 py-4">
        <SheetTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-sky-800" />
          Plan de cuotas · {row.number}
        </SheetTitle>
        <SheetDescription>
          {row.clientName} — {row.opportunityTitle}
          <br />
          Total a cobrar: <span className="font-medium">{fmtUsd(total)}</span>
          {" · "}Garantía aparte:{" "}
          <span className="font-medium">{fmtUsd(row.depositAmount)}</span>
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-5 py-4">
          {/* Generador rápido */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="size-3.5 text-sky-800" />
              Generar plan rápido
            </p>
            <div className="flex items-end gap-2">
              <div className="grid flex-1 gap-1">
                <Label className="text-[11px]">Porcentajes (deben sumar 100)</Label>
                <Input
                  placeholder="30/40/30"
                  value={pcts}
                  onChange={(e) => setPcts(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-[11px]">Primera fecha</Label>
                <DatePicker
                  value={firstDate}
                  onChange={setFirstDate}
                  className="w-full"
                />
              </div>
              <Button type="button" variant="secondary" onClick={generarPlan}>
                Generar
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Las cuotas siguientes se programan cada 30 días. Las cuotas con pagos no se
              reemplazan.
            </p>
          </div>

          {/* Cuotas */}
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
              <CalendarClock className="size-7 text-muted-foreground/60" />
              <p className="text-sm font-medium">Sin plan de cuotas</p>
              <p className="max-w-56 text-[11px] text-muted-foreground">
                Genera un plan rápido con porcentajes o agrega cuotas manualmente.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={agregarCuota}>
                <Plus className="size-3.5" />
                Agregar cuota
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((r, idx) => {
                const st = displayStatus(
                  r.status,
                  r.dueDate,
                  r.paidUsd >= (parseFloat(r.amount) || Infinity) - 0.01
                );
                return (
                  <div
                    key={r.id ?? `new-${idx}`}
                    className={cn(
                      "rounded-lg border p-3",
                      st === "VENCIDA" && "border-rose-200 bg-rose-50/50"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Input
                        className="h-7 flex-1 font-medium"
                        value={r.label}
                        disabled={r.locked}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x, i) =>
                              i === idx ? { ...x, label: e.target.value } : x
                            )
                          )
                        }
                      />
                      <Badge variant="outline" className={INSTALLMENT_STATUS_COLORS[st]}>
                        {INSTALLMENT_STATUS_LABELS[st] ?? st}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="grid flex-1 gap-1">
                        <Label className="text-[10px] text-muted-foreground">Vence</Label>
                        <DatePicker
                          className="h-7 w-full"
                          value={r.dueDate}
                          onChange={(v) =>
                            setRows((rs) =>
                              rs.map((x, i) =>
                                i === idx ? { ...x, dueDate: v } : x
                              )
                            )
                          }
                        />
                      </div>
                      <div className="grid w-28 gap-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Monto USD
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          className="h-7"
                          value={r.amount}
                          disabled={r.locked}
                          onChange={(e) =>
                            setRows((rs) =>
                              rs.map((x, i) =>
                                i === idx ? { ...x, amount: e.target.value } : x
                              )
                            )
                          }
                        />
                      </div>
                      <div className="flex items-end gap-1 self-end">
                        {r.id && row.unassignedPayments.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title="Asociar pago a esta cuota"
                              >
                                <Link2 className="size-3.5 text-sky-800" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72">
                              <DropdownMenuLabel>Asociar pago sin cuota</DropdownMenuLabel>
                              {row.unassignedPayments.map((p) => (
                                <DropdownMenuItem
                                  key={p.id}
                                  onClick={() => asociar(p.id, r.id as string)}
                                >
                                  {p.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={r.locked}
                          title={
                            r.locked
                              ? "Tiene pagos asociados — no puede eliminarse"
                              : "Eliminar cuota"
                          }
                          onClick={() => quitarCuota(idx)}
                        >
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    {r.paidUsd > 0 && (
                      <p className="mt-1.5 text-[11px] text-emerald-700">
                        Pagado: {fmtUsd(r.paidUsd)}
                      </p>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={agregarCuota}>
                <Plus className="size-3.5" />
                Agregar cuota
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t px-5 py-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Suma del plan</span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              planMatches ? "text-emerald-700" : "text-amber-700"
            )}
          >
            {fmtUsd(sumPlan)} / {fmtUsd(total)}
          </span>
        </div>
        {!planMatches && rows.length > 0 && (
          <p className="mb-2 text-[11px] text-amber-700">
            La suma de cuotas no coincide con el total — puedes guardar igual, pero revisa
            los montos.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={pending || rows.length === 0}>
            {pending ? "Guardando…" : "Guardar plan"}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cuota?</AlertDialogTitle>
            <AlertDialogDescription>
              La cuota se eliminará del plan de pagos de {row.number}. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminar} disabled={pending}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
