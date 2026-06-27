"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, FilePlus2 } from "lucide-react";
import { formatDayEs } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ListFilters } from "@/components/shared/list-filters";
import {
  BEO_STATUS_COLORS,
  BEO_STATUS_LABELS,
  BEO_STATUSES,
  type BeoStatus,
} from "../constants";
import { GenerateBeoDialog, type BeoReservationOption } from "./generate-beo-dialog";

export interface BeoRow {
  id: string;
  number: number;
  status: string;
  eventName: string;
  clientName: string;
  spaceName: string | null;
  eventDate: string | null;
  pax: number | null;
}

export function BeoView({
  beos,
  reservationOptions,
  total,
  filtered,
  hasFilters,
}: {
  beos: BeoRow[];
  reservationOptions: BeoReservationOption[];
  /** Total de BEOs sin filtros (para el contador del encabezado). */
  total: number;
  /** Cantidad de BEOs tras aplicar los filtros (para "X de Y"). */
  filtered: number;
  /** ¿Hay algún filtro activo? Distingue "sin BEOs" de "sin coincidencias". */
  hasFilters: boolean;
}) {
  const [genOpen, setGenOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BEO — Órdenes de evento</h1>
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? `${filtered} de ${total} ${total === 1 ? "orden" : "órdenes"}`
              : `${total} ${total === 1 ? "orden" : "órdenes"}`}{" "}
            · instrucciones operativas por evento, compartidas con todos los departamentos
          </p>
        </div>
        <Button onClick={() => setGenOpen(true)} className="bg-sky-950 hover:bg-sky-900">
          <FilePlus2 data-icon="inline-start" />
          Generar BEO
        </Button>
      </div>

      <ListFilters
        searchPlaceholder="Buscar por Nº, evento o cliente…"
        searchAriaLabel="Buscar BEOs"
        statusOptions={BEO_STATUSES.map((s) => ({ value: s, label: BEO_STATUS_LABELS[s] }))}
        statusAllLabel="Todos los estados"
        dateRange={{ label: "Fecha del evento" }}
        direction={{ ascLabel: "Nº ascendente", descLabel: "Nº descendente", defaultDir: "desc" }}
      />

      <Card>
        <CardContent className="p-0">
          {beos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <ClipboardList className="size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">
                {hasFilters ? "Ningún BEO coincide con el filtro" : "Todavía no hay BEOs"}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasFilters
                  ? "Probá con otra búsqueda, estado o rango de fechas."
                  : "Generá un BEO desde una reserva de salón confirmada con el botón de arriba."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>BEO</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">PAX</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {beos.map((b) => (
                  <TableRow key={b.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono font-semibold tabular-nums">
                      <Link href={`/beo/${b.id}`} className="block">
                        #{b.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/beo/${b.id}`} className="block font-medium">
                        {b.eventName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/beo/${b.id}`} className="block">
                        {b.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.eventDate ? formatDayEs(new Date(b.eventDate), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.pax ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn(BEO_STATUS_COLORS[b.status as BeoStatus])}>
                        {BEO_STATUS_LABELS[b.status as BeoStatus] ?? b.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <GenerateBeoDialog open={genOpen} onOpenChange={setGenOpen} reservations={reservationOptions} />
    </div>
  );
}
