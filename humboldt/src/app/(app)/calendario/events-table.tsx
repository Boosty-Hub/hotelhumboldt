"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDownUp, CalendarX2, Search, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
} from "@/lib/constants";
import { RESERVATION_STATUS_COLORS, type CalendarSpaceDTO, type ReservationDTO } from "./types";

const ALL = "TODOS";
type SortDir = "asc" | "desc";

interface EventsTableProps {
  /** Todas las reservas-evento (cualquier mes), una fila por reserva de salón. */
  reservations: ReservationDTO[];
  spaces: CalendarSpaceDTO[];
}

/**
 * Pestaña "Eventos": listado tabular de todos los eventos por salón (cada
 * reserva = un evento en un salón un día). Filtros 100% en cliente sobre los
 * datos ya cargados, para no recargar la página al cambiar de pestaña.
 */
export function EventsTable({ reservations, spaces }: EventsTableProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [salonId, setSalonId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [dir, setDir] = useState<SortDir>("desc");

  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = reservations.filter((r) => {
      if (salonId !== ALL && r.spaceId !== salonId) return false;
      if (status !== ALL && r.status !== status) return false;
      if (term) {
        const hay =
          `${r.eventName} ${r.clientName ?? ""} ${r.opportunityCode ?? ""} ${r.opportunityTitle ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    // Orden por fecha; desempate estable por nombre para fechas iguales.
    filtered.sort((a, b) => {
      const cmp = a.dateKey.localeCompare(b.dateKey) || a.eventName.localeCompare(b.eventName);
      return dir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [reservations, q, salonId, status, dir]);

  const hasFilters = q.trim() !== "" || salonId !== ALL || status !== ALL;

  function clearAll() {
    setQ("");
    setSalonId(ALL);
    setStatus(ALL);
  }

  return (
    <div className="space-y-3">
      {/* Barra de filtros (cliente) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por evento, cliente u oportunidad…"
            className="pl-8"
            aria-label="Buscar eventos"
          />
        </div>

        <Select value={salonId} onValueChange={setSalonId}>
          <SelectTrigger className="w-44" aria-label="Filtrar por salón">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los salones</SelectItem>
            {spaces.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {RESERVATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {RESERVATION_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          className="h-7"
          onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
          aria-label="Cambiar orden por fecha"
        >
          <ArrowDownUp data-icon="inline-start" />
          {dir === "asc" ? "Más antiguos" : "Más recientes"}
        </Button>

        {hasFilters && (
          <Button variant="ghost" className="h-7" onClick={clearAll}>
            <X data-icon="inline-start" />
            Limpiar
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "evento" : "eventos"}
        </span>
      </div>

      {reservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
            <CalendarX2 className="h-6 w-6 text-sky-900" />
          </div>
          <div>
            <p className="font-medium">Aún no hay eventos en salones</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Reservá un salón desde la pestaña Calendario para ver el evento acá.
            </p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card py-16 text-center">
          <p className="font-medium">Sin resultados</p>
          <p className="text-sm text-muted-foreground">
            Probá con otra búsqueda, salón o estado.
          </p>
          <Button variant="outline" className="mt-1" onClick={clearAll}>
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Salón</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Oportunidad</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const space = spaceById.get(r.spaceId);
                const date = parseISO(r.dateKey);
                const maintenance = r.type === "MANTENIMIENTO";
                const href = r.eventId ? `/eventos/${r.eventId}` : null;
                return (
                  <TableRow
                    key={r.id}
                    className={cn("group", href && "cursor-pointer", r.status === "CANCELADA" && "opacity-60")}
                    onClick={href ? () => router.push(href) : undefined}
                  >
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <span className="font-medium">{format(date, "dd/MM/yyyy", { locale: es })}</span>
                      <span className="block text-[10px] font-normal capitalize text-muted-foreground">
                        {format(date, "EEEE", { locale: es })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: space?.color ?? "#0ea5e9" }}
                        />
                        <span className="max-w-40 truncate" title={space?.name}>
                          {space?.name ?? "—"}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-52">
                      {href ? (
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 truncate font-medium text-sky-950 hover:underline dark:text-sky-200"
                          title={r.eventName}
                        >
                          {maintenance && <Wrench className="size-3 shrink-0 text-muted-foreground" />}
                          <span className="truncate">{r.eventName}</span>
                        </Link>
                      ) : (
                        <span className="flex items-center gap-1.5 truncate" title={r.eventName}>
                          {maintenance && <Wrench className="size-3 shrink-0 text-muted-foreground" />}
                          <span className="truncate">{r.eventName}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-44">
                      <p className="truncate" title={r.clientName ?? undefined}>
                        {r.clientName ?? <span className="text-muted-foreground">—</span>}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.opportunityId && r.opportunityCode ? (
                        <Link
                          href={`/pipeline/${r.opportunityId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-sky-950 hover:underline dark:text-sky-300"
                          title={r.opportunityTitle ?? undefined}
                        >
                          {r.opportunityCode}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.startTime ? `${r.startTime}${r.endTime ? `–${r.endTime}` : ""}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(RESERVATION_STATUS_COLORS[r.status])}>
                        {RESERVATION_STATUS_LABELS[r.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
