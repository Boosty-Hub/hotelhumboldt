"use client";

// Tabla "Pagos registrados" con filtros por método, tipo y mes.

import * as React from "react";
import Link from "next/link";
import { FilterX, Receipt } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtUsd, fmtBs, fmtNum } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  type PaymentMethod,
  type PaymentType,
} from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PaymentRow } from "../types";

const TYPE_COLORS: Record<string, string> = {
  ABONO: "bg-sky-100 text-sky-800 border-sky-200",
  ANTICIPO: "bg-violet-100 text-violet-800 border-violet-200",
  GARANTIA: "bg-amber-100 text-amber-800 border-amber-200",
  REINTEGRO: "bg-rose-100 text-rose-800 border-rose-200",
};

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const [metodo, setMetodo] = React.useState("all");
  const [tipo, setTipo] = React.useState("all");
  const [mes, setMes] = React.useState("all");

  const meses = React.useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) {
      const d = new Date(r.date);
      const key = format(d, "yyyy-MM");
      if (!set.has(key)) {
        const label = format(d, "MMMM yyyy", { locale: es });
        set.set(key, label.charAt(0).toUpperCase() + label.slice(1));
      }
    }
    return [...set.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (metodo !== "all" && r.method !== metodo) return false;
    if (tipo !== "all" && r.type !== tipo) return false;
    if (mes !== "all" && format(new Date(r.date), "yyyy-MM") !== mes) return false;
    return true;
  });

  const totalUsd = filtered.reduce((s, r) => s + r.amountUsd, 0);
  const hasFilters = metodo !== "all" || tipo !== "all" || mes !== "all";

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={metodo} onValueChange={setMetodo}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los métodos</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {PAYMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {PAYMENT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los meses</SelectItem>
            {meses.map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMetodo("all");
              setTipo("all");
              setMes("all");
            }}
          >
            <FilterX className="size-3.5" />
            Limpiar
          </Button>
        )}
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} pago{filtered.length === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-foreground">{fmtUsd(totalUsd)}</span>
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Receipt className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {hasFilters ? "Sin pagos con esos filtros" : "Aún no hay pagos registrados"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                {hasFilters
                  ? "Ajusta o limpia los filtros para ver más resultados."
                  : "Usa «Registrar pago» para asentar el primer abono, anticipo o garantía."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Fecha</TableHead>
                  <TableHead>Cliente / oportunidad</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto original</TableHead>
                  <TableHead className="text-right">Tasa</TableHead>
                  <TableHead className="text-right">Equiv. USD</TableHead>
                  <TableHead className="pr-4">Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4 whitespace-nowrap">
                      {format(new Date(r.date), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/pagos/oportunidad/${r.opportunityId}`}
                        className="font-medium hover:underline"
                      >
                        {r.clientName}
                      </Link>
                      <p className="max-w-48 truncate text-[11px] text-muted-foreground">
                        {r.opportunityTitle}
                        {r.quoteNumber && ` · ${r.quoteNumber}`}
                        {r.installmentLabel && ` · ${r.installmentLabel}`}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-36 truncate">
                      {PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TYPE_COLORS[r.type]}>
                        {PAYMENT_TYPE_LABELS[r.type as PaymentType] ?? r.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.currency === "BS" ? fmtBs(r.amountOriginal) : fmtUsd(r.amountOriginal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.rateUsed ? fmtNum(r.rateUsed) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        r.amountUsd < 0 && "text-rose-600"
                      )}
                    >
                      {fmtUsd(r.amountUsd)}
                    </TableCell>
                    <TableCell className="pr-4 max-w-32 truncate text-muted-foreground">
                      {r.reference ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
