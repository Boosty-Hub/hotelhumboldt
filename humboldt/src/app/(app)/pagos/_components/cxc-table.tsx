"use client";

// Tabla "Cuentas por cobrar" — cotizaciones aprobadas/contratadas con
// saldo, garantía aparte, próxima cuota y acciones por fila.

import * as React from "react";
import Link from "next/link";
import { Banknote, CalendarClock, FileSearch, Inbox, ShieldCheck } from "lucide-react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { CxcRow, TargetOption } from "../types";
import { PaymentDialog, type BankAccountOption } from "./payment-dialog";
import { InstallmentsSheet } from "./installments-sheet";

function saldoColor(row: CxcRow): string {
  if (row.saldo <= 0.01) return "text-emerald-700";
  if (row.hasOverdue) return "text-rose-600";
  if (row.pagado + row.retencionesUsd > 0) return "text-amber-700";
  return "text-foreground";
}

export function CxcTable({
  rows,
  targets,
  defaultRate,
  bankAccounts,
}: {
  rows: CxcRow[];
  targets: TargetOption[];
  defaultRate: number | null;
  bankAccounts: BankAccountOption[];
}) {
  const [payTarget, setPayTarget] = React.useState<string | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);
  const [planRow, setPlanRow] = React.useState<CxcRow | null>(null);
  const [planOpen, setPlanOpen] = React.useState(false);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Sin cuentas por cobrar</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Cuando una cotización pase a estado Aprobada o Contratada aparecerá aquí
              para gestionar su cobranza.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/cotizaciones">Ir a cotizaciones</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Cotización</TableHead>
                <TableHead>Cliente / evento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">
                      Garantía
                    </TooltipTrigger>
                    <TooltipContent>
                      Depósito reembolsable — se cobra aparte, no forma parte del precio.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Próxima cuota</TableHead>
                <TableHead className="pr-4 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.quoteId}>
                  <TableCell className="pl-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{row.number}</span>
                      <Badge
                        variant="outline"
                        className={QUOTE_STATUS_COLORS[row.status as QuoteStatus]}
                      >
                        {QUOTE_STATUS_LABELS[row.status as QuoteStatus] ?? row.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/pagos/oportunidad/${row.opportunityId}`}
                      className="font-medium hover:underline"
                    >
                      {row.clientName}
                    </Link>
                    <p className="max-w-52 truncate text-[11px] text-muted-foreground">
                      {row.opportunityTitle}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {fmtUsd(row.totalUsd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div className="flex flex-col items-end">
                      <span className="text-muted-foreground">{fmtUsd(row.depositAmount)}</span>
                      {row.garantiaRecibida > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-700">
                          <ShieldCheck className="size-3" />
                          {fmtUsd(row.garantiaRecibida)} recibida
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtUsd(row.pagado)}
                    {row.retencionesUsd > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        + {fmtUsd(row.retencionesUsd)} retenciones
                      </p>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn("text-right font-semibold tabular-nums", saldoColor(row))}
                  >
                    {fmtUsd(Math.max(row.saldo, 0))}
                    {row.saldo <= 0.01 && (
                      <p className="text-[11px] font-normal">Cobrado</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.nextInstallment ? (
                      <div className="text-xs">
                        <p className="font-medium">{row.nextInstallment.label}</p>
                        <p
                          className={cn(
                            "text-[11px]",
                            row.nextInstallment.overdue
                              ? "font-medium text-rose-600"
                              : "text-muted-foreground"
                          )}
                        >
                          {format(new Date(row.nextInstallment.dueDate), "dd MMM yyyy", {
                            locale: es,
                          })}
                          {row.nextInstallment.overdue && " · vencida"}
                          {" · "}
                          {fmtUsd(row.nextInstallment.amount)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Sin plan</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              setPayTarget(`Q:${row.quoteId}`);
                              setPayOpen(true);
                            }}
                          >
                            <Banknote className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Registrar pago</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              setPlanRow(row);
                              setPlanOpen(true);
                            }}
                          >
                            <CalendarClock className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Plan de cuotas</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-sm" asChild>
                            <Link href={`/pagos/oportunidad/${row.opportunityId}`}>
                              <FileSearch className="size-3.5" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Estado de cuenta</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaymentDialog
        targets={targets}
        defaultRate={defaultRate}
        bankAccounts={bankAccounts}
        open={payOpen}
        onOpenChange={setPayOpen}
        presetTargetValue={payTarget}
      />
      <InstallmentsSheet row={planRow} open={planOpen} onOpenChange={setPlanOpen} />
    </TooltipProvider>
  );
}
