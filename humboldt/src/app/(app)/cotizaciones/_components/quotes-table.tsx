"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Eye, Layers, Pencil } from "lucide-react";
import { fmtUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuoteStatusBadge } from "@/components/quote/quote-status-badge";

export interface QuoteRow {
  id: string;
  baseNumber: string;
  version: number;
  clientName: string;
  clientLegal: string | null;
  eventName: string;
  eventDateLabel: string | null;
  issueDateLabel: string;
  validityText: string;
  validityClass: string;
  totalUsd: number;
  status: string;
  signerName: string;
}

export interface QuoteGroup {
  baseNumber: string;
  versions: QuoteRow[]; // orden: versión más reciente primero
}

function RowActions({ id }: { id: string }) {
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href={`/cotizaciones/${id}/editar`} aria-label="Editar cotización">
          <Pencil className="h-3 w-3" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href={`/cotizaciones/${id}`} aria-label="Ver documento">
          <Eye className="h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}

export function QuotesTable({ groups }: { groups: QuoteGroup[] }) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (base: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(base)) next.delete(base);
      else next.add(base);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Emisión</TableHead>
            <TableHead>Vigencia</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Firmante</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const latest = group.versions[0];
            const olderCount = group.versions.length - 1;
            const isOpen = expanded.has(group.baseNumber);
            return (
              <React.Fragment key={group.baseNumber}>
                {/* Fila principal: versión más reciente */}
                <TableRow className="group">
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {olderCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggle(group.baseNumber)}
                          aria-label={isOpen ? "Ocultar versiones" : "Ver versiones"}
                          aria-expanded={isOpen}
                          className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight
                            className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
                          />
                        </button>
                      ) : (
                        <span className="size-4 shrink-0" />
                      )}
                      <Link
                        href={`/cotizaciones/${latest.id}/editar`}
                        className="flex items-center gap-1.5 font-medium text-sky-950 hover:underline dark:text-sky-200"
                      >
                        {group.baseNumber}
                        {latest.version > 1 && (
                          <Badge variant="outline" className="text-[10px]">
                            v{latest.version}
                          </Badge>
                        )}
                      </Link>
                      {olderCount > 0 && (
                        <button
                          type="button"
                          onClick={() => toggle(group.baseNumber)}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                          title="Ver todas las versiones"
                        >
                          <Layers className="size-2.5" />
                          {group.versions.length} versiones
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-44 truncate font-medium">{latest.clientName}</p>
                    {latest.clientLegal && (
                      <p className="max-w-44 truncate text-xs text-muted-foreground">
                        {latest.clientLegal}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48">
                    <p className="truncate">{latest.eventName}</p>
                    {latest.eventDateLabel && (
                      <p className="text-xs text-muted-foreground">{latest.eventDateLabel}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{latest.issueDateLabel}</TableCell>
                  <TableCell>
                    <span className={cn("text-sm", latest.validityClass)}>{latest.validityText}</span>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtUsd(latest.totalUsd)}
                  </TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={latest.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{latest.signerName}</TableCell>
                  <TableCell>
                    <RowActions id={latest.id} />
                  </TableCell>
                </TableRow>

                {/* Versiones anteriores (desplegables) */}
                {isOpen &&
                  group.versions.slice(1).map((v) => (
                    <TableRow key={v.id} className="group bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-1.5 pl-5">
                          <Link
                            href={`/cotizaciones/${v.id}/editar`}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {group.baseNumber}
                            <Badge variant="outline" className="text-[10px]">
                              v{v.version}
                            </Badge>
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.clientName}</TableCell>
                      <TableCell className="max-w-48">
                        <p className="truncate text-xs text-muted-foreground">{v.eventName}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{v.issueDateLabel}</TableCell>
                      <TableCell>
                        <span className={cn("text-sm", v.validityClass)}>{v.validityText}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmtUsd(v.totalUsd)}
                      </TableCell>
                      <TableCell>
                        <QuoteStatusBadge status={v.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{v.signerName}</TableCell>
                      <TableCell>
                        <RowActions id={v.id} />
                      </TableCell>
                    </TableRow>
                  ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
