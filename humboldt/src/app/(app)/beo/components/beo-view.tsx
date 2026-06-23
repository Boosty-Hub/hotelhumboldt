"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ClipboardList, FilePlus2, Search } from "lucide-react";
import { formatDayEs } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { BEO_STATUS_COLORS, BEO_STATUS_LABELS, type BeoStatus } from "../constants";
import { GenerateBeoDialog, type UpcomingEvent } from "./generate-beo-dialog";

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

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function BeoView({
  beos,
  upcomingEvents,
}: {
  beos: BeoRow[];
  upcomingEvents: UpcomingEvent[];
}) {
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(""); // yyyy-MM
  const [asc, setAsc] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

  const rows = useMemo(() => {
    const q = norm(search.trim());
    const filtered = beos.filter((b) => {
      if (
        q &&
        !(
          norm(b.eventName).includes(q) ||
          norm(b.clientName).includes(q) ||
          String(b.number).includes(q)
        )
      )
        return false;
      if (month && (!b.eventDate || b.eventDate.slice(0, 7) !== month)) return false;
      return true;
    });
    return filtered.sort((a, b) => (asc ? a.number - b.number : b.number - a.number));
  }, [beos, search, month, asc]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BEO — Órdenes de evento</h1>
          <p className="text-sm text-muted-foreground">
            {beos.length} {beos.length === 1 ? "orden" : "órdenes"} · instrucciones operativas por
            evento, compartidas con todos los departamentos
          </p>
        </div>
        <Button onClick={() => setGenOpen(true)} className="bg-sky-950 hover:bg-sky-900">
          <FilePlus2 data-icon="inline-start" />
          Generar BEO
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-64">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Nº, evento o cliente…"
            className="pl-8"
          />
        </div>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-40"
          aria-label="Filtrar por mes del evento"
        />
        <Button variant="outline" size="sm" onClick={() => setAsc((v) => !v)}>
          <ArrowDownUp data-icon="inline-start" />
          Nº {asc ? "ascendente" : "descendente"}
        </Button>
        {(search || month) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setMonth("");
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <ClipboardList className="size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">
                {beos.length === 0 ? "Todavía no hay BEOs" : "Ningún BEO coincide con el filtro"}
              </p>
              <p className="text-xs text-muted-foreground">
                Generá un BEO desde un evento próximo con el botón de arriba.
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
                {rows.map((b) => (
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

      <GenerateBeoDialog open={genOpen} onOpenChange={setGenOpen} events={upcomingEvents} />
    </div>
  );
}
