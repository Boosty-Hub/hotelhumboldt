"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtUsd, fmtBs } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  type PaymentMethod,
  type PaymentType,
} from "@/lib/constants";
import { setPaymentReconciled } from "../actions";

export interface MovRow {
  id: string;
  date: string; // ISO
  amountOriginal: number;
  currency: string;
  amountUsd: number;
  method: string;
  type: string;
  reference: string | null;
  reconciled: boolean;
  clientName: string;
  oppCode: string;
  oppId: string;
}

type Filter = "all" | "pending" | "done";

export function ReconcileTable({ rows }: { rows: MovRow[] }) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = rows.filter(
    (r) =>
      filter === "all" ||
      (filter === "pending" && !r.reconciled) ||
      (filter === "done" && r.reconciled)
  );
  const pendientes = rows.filter((r) => !r.reconciled).length;

  function toggle(r: MovRow) {
    startTransition(async () => {
      const res = await setPaymentReconciled({ paymentId: r.id, reconciled: !r.reconciled });
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  const fmtMonto = (r: MovRow) =>
    r.currency === "BS" ? fmtBs(r.amountOriginal) : fmtUsd(r.amountOriginal);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", `Todos (${rows.length})`],
            ["pending", `Por conciliar (${pendientes})`],
            ["done", `Conciliados (${rows.length - pendientes})`],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay movimientos {filter === "pending" ? "por conciliar" : filter === "done" ? "conciliados" : ""}.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Método / Tipo</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-center">Conciliado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className={r.reconciled ? "" : "bg-amber-50/40"}>
                <TableCell className="text-xs">
                  {format(new Date(r.date), "dd/MM/yyyy", { locale: es })}
                </TableCell>
                <TableCell>
                  <Link href={`/pagos/oportunidad/${r.oppId}`} className="hover:underline">
                    <span className="text-sm">{r.clientName}</span>
                    <span className="ml-1.5 text-[11px] text-muted-foreground">{r.oppCode}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-xs">
                  {PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method}
                  <span className="ml-1 text-muted-foreground">
                    · {PAYMENT_TYPE_LABELS[r.type as PaymentType] ?? r.type}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.reference || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMonto(r)}
                  {r.currency === "BS" && (
                    <span className="block text-[11px] text-muted-foreground">
                      ≈ {fmtUsd(r.amountUsd)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <Switch
                      checked={r.reconciled}
                      disabled={pending}
                      onCheckedChange={() => toggle(r)}
                      aria-label={r.reconciled ? "Marcar como pendiente" : "Marcar como conciliado"}
                    />
                    {r.reconciled ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Conciliado
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-amber-700">Pendiente</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
