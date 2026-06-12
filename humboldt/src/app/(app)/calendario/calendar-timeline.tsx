"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMonths, format, getDaysInMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
  CalendarX2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NewReservationDialog } from "./new-reservation-dialog";
import { ReservationSheet } from "./reservation-sheet";
import type {
  CalendarSpaceDTO,
  ConflictDTO,
  EventOptionDTO,
  OpportunityOptionDTO,
  ReservationDTO,
} from "./types";

interface CalendarTimelineProps {
  month: string; // yyyy-MM
  spaces: CalendarSpaceDTO[];
  reservations: ReservationDTO[];
  conflicts: ConflictDTO[];
  events: EventOptionDTO[];
  opportunities: OpportunityOptionDTO[];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function CalendarTimeline({
  month,
  spaces,
  reservations,
  conflicts,
  events,
  opportunities,
}: CalendarTimelineProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<ReservationDTO | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const monthDate = parseISO(`${month}-01`);
  const daysInMonth = getDaysInMonth(monthDate);
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const monthLabel = capitalize(format(monthDate, "MMMM yyyy", { locale: es }));
  const [yearStr, monthStr] = month.split("-");

  const dayKeys = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
    [month, daysInMonth]
  );

  const cellMap = useMemo(() => {
    const map = new Map<string, ReservationDTO[]>();
    for (const r of reservations) {
      const key = `${r.spaceId}|${r.dateKey}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [reservations]);

  const conflictKeys = useMemo(
    () => new Set(conflicts.map((c) => `${c.spaceId}|${c.dateKey}`)),
    [conflicts]
  );

  function navigate(nextMonth: string) {
    startTransition(() => {
      router.push(`/calendario?mes=${nextMonth}`);
    });
  }

  function shiftMonth(delta: number) {
    navigate(format(addMonths(monthDate, delta), "yyyy-MM"));
  }

  function openReservation(r: ReservationDTO) {
    setSelected(r);
    setSheetOpen(true);
  }

  const yearNow = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => String(yearNow - 2 + i));
  if (!yearOptions.includes(yearStr)) yearOptions.push(yearStr);

  return (
    <div className="space-y-4">
      {/* Listado de conflictos */}
      {conflicts.length > 0 && (
        <Alert className="border-rose-200 bg-rose-50 text-rose-900">
          <TriangleAlert className="size-4 text-rose-600" />
          <AlertTitle>
            {conflicts.length === 1
              ? "1 conflicto de reservas detectado este mes"
              : `${conflicts.length} conflictos de reservas detectados este mes`}
          </AlertTitle>
          <AlertDescription className="text-rose-800">
            <ul className="mt-1 space-y-0.5">
              {conflicts.map((c) => (
                <li key={`${c.spaceId}-${c.dateKey}`} className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: c.spaceColor }}
                  />
                  <span className="font-medium">{c.spaceName}</span>
                  <span>— {format(parseISO(c.dateKey), "EEEE d 'de' MMMM", { locale: es })}:</span>
                  <span>{c.eventNames.map((n) => `“${n}”`).join(" vs ")}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden p-0">
        {/* Barra de herramientas */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => shiftMonth(-1)}
              aria-label="Mes anterior"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => shiftMonth(1)}
              aria-label="Mes siguiente"
            >
              <ChevronRight />
            </Button>
            <Button variant="outline" onClick={() => navigate(format(new Date(), "yyyy-MM"))}>
              Hoy
            </Button>
            <Select value={monthStr} onValueChange={(m) => navigate(`${yearStr}-${m}`)}>
              <SelectTrigger className="w-[120px]" aria-label="Mes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const value = String(i + 1).padStart(2, "0");
                  return (
                    <SelectItem key={value} value={value}>
                      {capitalize(format(new Date(2026, i, 1), "MMMM", { locale: es }))}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={yearStr} onValueChange={(y) => navigate(`${y}-${monthStr}`)}>
              <SelectTrigger className="w-[84px]" aria-label="Año">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-1 hidden text-sm font-semibold sm:inline">{monthLabel}</span>
          </div>
          <Button onClick={() => setNewOpen(true)}>
            <CalendarPlus data-icon="inline-start" />
            Nueva reserva
          </Button>
        </div>

        {/* Aviso de mes sin reservas */}
        {reservations.length === 0 && (
          <div className="flex items-center justify-center gap-2 border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <CalendarX2 className="size-3.5" />
            No hay reservas en {monthLabel.toLowerCase()}.
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="font-medium text-sky-950 underline-offset-2 hover:underline dark:text-sky-300"
            >
              Crear la primera
            </button>
          </div>
        )}

        {/* Timeline */}
        <div className={cn("overflow-x-auto", isPending && "pointer-events-none opacity-50")}>
          <div
            className="grid w-max min-w-full"
            style={{ gridTemplateColumns: `200px repeat(${daysInMonth}, minmax(44px, 1fr))` }}
          >
            {/* Encabezado de días */}
            <div className="sticky left-0 z-20 border-b bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Salón
            </div>
            {dayKeys.map((key, i) => {
              const date = parseISO(key);
              const dow = date.getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={cn(
                    "flex flex-col items-center gap-0.5 border-b border-l py-1.5",
                    isWeekend && "bg-muted/50"
                  )}
                >
                  <span className="text-[9px] uppercase text-muted-foreground">
                    {format(date, "EEEEEE", { locale: es })}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                      isToday && "bg-sky-950 text-white"
                    )}
                    title={isToday ? "Hoy" : undefined}
                  >
                    {i + 1}
                  </span>
                </div>
              );
            })}

            {/* Filas por salón */}
            {spaces.map((space) => (
              <SpaceRow
                key={space.id}
                space={space}
                dayKeys={dayKeys}
                todayKey={todayKey}
                cellMap={cellMap}
                conflictKeys={conflictKeys}
                onSelect={openReservation}
              />
            ))}
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm bg-sky-950" />
            Confirmada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm border-[1.5px] border-dashed border-sky-950 bg-sky-950/15" />
            Tentativa
          </span>
          <span className="flex items-center gap-1.5">
            <TriangleAlert className="size-3.5 text-rose-600" />
            Conflicto de fechas
          </span>
          <span className="ml-auto hidden sm:inline">
            Las reservas canceladas no se muestran en el calendario.
          </span>
        </div>
      </Card>

      <NewReservationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        month={month}
        spaces={spaces}
        events={events}
        opportunities={opportunities}
      />

      <ReservationSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        reservation={selected}
        space={selected ? spaces.find((s) => s.id === selected.spaceId) ?? null : null}
      />
    </div>
  );
}

// ── Fila de un salón ────────────────────────────────────────────────────
function SpaceRow({
  space,
  dayKeys,
  todayKey,
  cellMap,
  conflictKeys,
  onSelect,
}: {
  space: CalendarSpaceDTO;
  dayKeys: string[];
  todayKey: string;
  cellMap: Map<string, ReservationDTO[]>;
  conflictKeys: Set<string>;
  onSelect: (r: ReservationDTO) => void;
}) {
  return (
    <>
      {/* Nombre del salón (columna fija) */}
      <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-r bg-card px-3 py-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: space.color }} />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium" title={space.name}>
            {space.name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {space.capacity != null ? `${space.capacity} pax` : "Capacidad por definir"}
          </p>
        </div>
      </div>

      {/* Celdas de días */}
      {dayKeys.map((dayKey) => {
        const cellKey = `${space.id}|${dayKey}`;
        const items = cellMap.get(cellKey) ?? [];
        const hasConflict = conflictKeys.has(cellKey);
        const date = parseISO(dayKey);
        const dow = date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isToday = dayKey === todayKey;

        return (
          <div
            key={dayKey}
            className={cn(
              "relative min-h-[52px] space-y-0.5 border-b border-l p-0.5",
              isWeekend && "bg-muted/50",
              isToday && "bg-sky-50/70 dark:bg-sky-950/20",
              hasConflict && "bg-rose-50 ring-1 ring-inset ring-rose-300"
            )}
          >
            {hasConflict && (
              <TriangleAlert
                className="absolute right-0.5 top-0.5 z-[1] size-3 text-rose-600"
                aria-label="Conflicto de reservas"
              />
            )}
            {items.map((r) => {
              const confirmed = r.status === "CONFIRMADA";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelect(r)}
                  title={`${r.eventName} — ${r.clientName}${r.startTime ? ` · ${r.startTime}${r.endTime ? `–${r.endTime}` : ""}` : ""}`}
                  className={cn(
                    "block w-full truncate rounded-sm px-1 py-1 text-left text-[10px] font-medium leading-tight transition-opacity hover:opacity-80",
                    !confirmed && "opacity-80"
                  )}
                  style={
                    confirmed
                      ? { backgroundColor: space.color, color: "#fff" }
                      : {
                          backgroundColor: `${space.color}24`,
                          border: `1.5px dashed ${space.color}`,
                          color: space.color,
                        }
                  }
                >
                  {r.eventName}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
