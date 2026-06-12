"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createReservation } from "./actions";
import type { CalendarSpaceDTO, EventOptionDTO, OpportunityOptionDTO } from "./types";

interface NewReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string; // yyyy-MM visible
  spaces: CalendarSpaceDTO[];
  events: EventOptionDTO[];
  opportunities: OpportunityOptionDTO[];
}

interface ComboItem {
  id: string;
  label: string;
  description?: string;
}

/** Combobox accesible basado en Popover + Command. */
function Combobox({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
}: {
  items: ComboItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  keywords={[item.label, item.description ?? ""]}
                  onSelect={() => {
                    onChange(item.id === value ? null : item.id);
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.label}</p>
                    {item.description && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                  {value === item.id && <Check className="ml-1 size-3.5 shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function NewReservationDialog({
  open,
  onOpenChange,
  month,
  spaces,
  events,
  opportunities,
}: NewReservationDialogProps) {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const defaultDate = todayKey.startsWith(month) ? todayKey : `${month}-01`;

  const [spaceId, setSpaceId] = useState<string>("");
  const [mode, setMode] = useState<"existente" | "nuevo">("existente");
  const [eventId, setEventId] = useState<string | null>(null);
  const [newEventName, setNewEventName] = useState("");
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [from, setFrom] = useState(defaultDate);
  const [to, setTo] = useState(defaultDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setSpaceId("");
    setMode(events.length > 0 ? "existente" : "nuevo");
    setEventId(null);
    setNewEventName("");
    setOpportunityId(null);
    setFrom(defaultDate);
    setTo(defaultDate);
    setStartTime("");
    setEndTime("");
    setNotes("");
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!spaceId) {
      toast.error("Seleccione un salón.");
      return;
    }
    if (mode === "existente" && !eventId) {
      toast.error("Seleccione el evento a reservar.");
      return;
    }
    if (mode === "nuevo" && (!newEventName.trim() || !opportunityId)) {
      toast.error("Indique el nombre del evento y la oportunidad asociada.");
      return;
    }

    startTransition(async () => {
      const res = await createReservation({
        spaceId,
        eventId: mode === "existente" ? eventId : null,
        newEventName: mode === "nuevo" ? newEventName.trim() : null,
        opportunityId: mode === "nuevo" ? opportunityId : null,
        from,
        to,
        startTime: startTime || null,
        endTime: endTime || null,
        notes: notes.trim() || null,
      });
      if (res.ok) {
        if (res.warning) toast.warning(res.warning, { duration: 8000 });
        toast.success(res.message ?? "Reserva creada.");
        onOpenChange(false);
      } else {
        toast.error(res.error, { duration: 8000 });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva reserva de salón</DialogTitle>
          <DialogDescription>
            Se crea una reserva por cada día del rango, en estado{" "}
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 align-middle">
              Tentativa
            </Badge>
            . Luego podrá confirmarla desde el calendario.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Salón */}
          <div className="space-y-1.5">
            <Label>Salón *</Label>
            <Select value={spaceId} onValueChange={setSpaceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccione un salón" />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                      {s.capacity != null && (
                        <span className="text-muted-foreground">· {s.capacity} pax</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Evento */}
          <div className="space-y-1.5">
            <Label>Evento *</Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "existente" | "nuevo")}>
              <TabsList className="w-full">
                <TabsTrigger value="existente" className="flex-1">
                  Evento existente
                </TabsTrigger>
                <TabsTrigger value="nuevo" className="flex-1">
                  Crear evento rápido
                </TabsTrigger>
              </TabsList>
              <TabsContent value="existente" className="mt-2">
                {events.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
                    Aún no hay eventos registrados. Use “Crear evento rápido” para asociarlo a una
                    oportunidad.
                  </p>
                ) : (
                  <Combobox
                    items={events.map((e) => ({
                      id: e.id,
                      label: e.name,
                      description: `${e.clientName} · ${e.opportunityCode}`,
                    }))}
                    value={eventId}
                    onChange={setEventId}
                    placeholder="Buscar evento…"
                    searchPlaceholder="Nombre del evento o cliente…"
                    emptyText="No se encontraron eventos."
                  />
                )}
              </TabsContent>
              <TabsContent value="nuevo" className="mt-2 space-y-2">
                <Input
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="Nombre del evento (ej. Fiesta de Navidad 2026)"
                  maxLength={120}
                />
                <Combobox
                  items={opportunities.map((o) => ({
                    id: o.id,
                    label: `${o.code} — ${o.title}`,
                    description: o.clientName,
                  }))}
                  value={opportunityId}
                  onChange={setOpportunityId}
                  placeholder="Oportunidad asociada…"
                  searchPlaceholder="Código, título o cliente…"
                  emptyText="No se encontraron oportunidades."
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-from">Desde *</Label>
              <Input
                id="res-from"
                type="date"
                value={from}
                onChange={(e) => {
                  const v = e.target.value;
                  setFrom(v);
                  if (v && (!to || to < v)) setTo(v);
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-to">Hasta *</Label>
              <Input
                id="res-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Franja horaria */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-start">Hora inicio (opcional)</Label>
              <Input
                id="res-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-end">Hora fin (opcional)</Label>
              <Input
                id="res-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="res-notes">Notas (opcional)</Label>
            <Textarea
              id="res-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Montaje, requerimientos especiales…"
              rows={2}
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Verificando disponibilidad…" : "Crear reserva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
