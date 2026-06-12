"use client";

// Tabla "Facturas" — fiscales, proformas y adicionales con retenciones.

import * as React from "react";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fmtUsd, fmtBs, fmtNum } from "@/lib/money";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  type InvoiceRow,
} from "../types";

const TYPE_COLORS: Record<string, string> = {
  FISCAL: "bg-indigo-100 text-indigo-800 border-indigo-200",
  PROFORMA: "bg-zinc-100 text-zinc-700 border-zinc-200",
  ADICIONALES: "bg-amber-100 text-amber-800 border-amber-200",
};

export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FileSpreadsheet className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Sin facturas registradas</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Registra las facturas fiscales emitidas en bolívares con «Registrar
              factura» y asóciales sus retenciones de IVA e ISLR.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nº</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente / oportunidad</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto Bs</TableHead>
              <TableHead className="text-right">Ref. USD</TableHead>
              <TableHead className="text-right">Tasa</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="pr-4">Retenciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4 font-medium">{r.number}</TableCell>
                <TableCell className="whitespace-nowrap">
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
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={TYPE_COLORS[r.type]}>
                    {INVOICE_TYPE_LABELS[r.type] ?? r.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {fmtBs(r.amountBs)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {fmtUsd(r.amountUsdRef)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {r.rateUsed ? fmtNum(r.rateUsed) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={INVOICE_STATUS_COLORS[r.status]}>
                    {INVOICE_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell className="pr-4">
                  {r.retentions.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {r.retentions.map((ret) => (
                        <span key={ret.id} className="text-[11px] tabular-nums">
                          <span className="font-medium">Ret. {ret.type}:</span>{" "}
                          {fmtBs(ret.amountBs)}
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
