"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ChevronsUpDown,
  Check,
  Loader2,
  ArrowLeft,
  FilePlus2,
  Building2,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  createQuote,
  checkSpaceAvailability,
  type NewOppOption,
  type SpaceAvailability,
} from "@/app/(app)/cotizaciones/actions";
import { NewOpportunityForQuoteDialog } from "./new-opportunity-dialog";

export interface OppOption {
  id: string;
  code: string;
  title: string;
  clientName: string;
  expectedEventDate: string | null; // yyyy-MM-dd
  pax: number | null;
}

/** Contacto + sus empresas (0, 1 o varias). Alimenta el diálogo de crear oportunidad. */
export interface ContactPickOption {
  id: string;
  name: string;
  title: string | null;
  clients: { id: string; name: string }[];
}

export interface ClientOption {
  id: string;
  legalName: string;
  brandName: string | null;
}

export interface SpaceOption {
  id: string;
  name: string;
}

interface Props {
  opportunities: OppOption[];
  contacts: ContactPickOption[];
  clients: ClientOption[];
  spaces: SpaceOption[];
  eventTypes: string[];
  channels: string[];
  preselectedOpportunityId: string | null;
  preselectedContactId?: string | null;
}

export function NewQuoteForm({
  opportunities,
  contacts,
  clients,
  spaces,
  eventTypes,
  channels,
  preselectedOpportunityId,
  preselectedContactId,
}: Props) {
  const [isPending, startTransition] = useTransition();

  // Oportunidades creadas al vuelo en esta sesión (se suman al selector).
  const [extraOpps, setExtraOpps] = useState<OppOption[]>([]);
  const allOpportunities = [...extraOpps, ...opportunities];

  const preselected = opportunities.find((o) => o.id === preselectedOpportunityId) ?? null;

  const [oppId, setOppId] = useState<string | null>(preselected?.id ?? null);
  const [oppOpen, setOppOpen] = useState(false);
  // Si se llega con un contacto (deep link "guardar y cotizar"), se abre el
  // diálogo de crear oportunidad con ese contacto ya seleccionado.
  const [newOppOpen, setNewOppOpen] = useState(Boolean(preselectedContactId));

  const [eventName, setEventName] = useState(preselected?.title ?? "");
  const [startDate, setStartDate] = useState(preselected?.expectedEventDate ?? "");
  const [datesTentative, setDatesTentative] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pax, setPax] = useState(preselected?.pax != null ? String(preselected.pax) : "");
  const [paxApproximate, setPaxApproximate] = useState(false);
  const [daysCount, setDaysCount] = useState("1");

  // Reserva de salón (opcional)
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [availability, setAvailability] = useState<Record<string, SpaceAvailability>>({});
  const [checkingAvail, startAvailCheck] = useTransition();

  // Consultá disponibilidad cuando cambian los salones o las fechas.
  useEffect(() => {
    if (selectedSpaceIds.length === 0 || !startDate) {
      setAvailability({});
      return;
    }
    startAvailCheck(async () => {
      const rows = await checkSpaceAvailability({
        spaceIds: selectedSpaceIds,
        startDate,
        daysCount: Number(daysCount) || 1,
      });
      setAvailability(Object.fromEntries(rows.map((r) => [r.spaceId, r])));
    });
  }, [selectedSpaceIds, startDate, daysCount]);

  const selectedOpp = allOpportunities.find((o) => o.id === oppId) ?? null;

  function applyOpportunity(opp: OppOption) {
    setOppId(opp.id);
    // Prefill desde la oportunidad si los campos están vacíos
    if (!eventName.trim()) setEventName(opp.title);
    if (!startDate && opp.expectedEventDate) setStartDate(opp.expectedEventDate);
    if (!pax && opp.pax != null) setPax(String(opp.pax));
  }

  function selectOpportunity(opp: OppOption) {
    setOppOpen(false);
    applyOpportunity(opp);
  }

  function onOpportunityCreated(opp: NewOppOption) {
    setExtraOpps((cur) => [opp, ...cur]);
    applyOpportunity(opp);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!oppId) {
      toast.error("Selecciona o creá la oportunidad");
      return;
    }
    if (eventName.trim().length < 3) {
      toast.error("Indica el nombre del evento (mínimo 3 caracteres)");
      return;
    }
    startTransition(async () => {
      const res = await createQuote({
        opportunityId: oppId,
        eventName: eventName.trim(),
        startDate,
        datesTentative,
        startTime,
        endTime,
        pax: pax ? Number(pax) : undefined,
        paxApproximate,
        daysCount: Number(daysCount) || 1,
        spaceIds: selectedSpaceIds,
      });
      // En éxito redirige al editor; si retorna, hubo error
      if (res && !res.ok) toast.error(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild type="button">
          <Link href="/cotizaciones" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Nueva cotización</h1>
          <p className="text-sm text-muted-foreground">
            Se creará como borrador con los parámetros comerciales vigentes.
          </p>
        </div>
      </div>

      {/* ── Origen: oportunidad (existente o nueva) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">¿Para qué oportunidad es la cotización?</CardTitle>
          <CardDescription>
            Toda cotización nace de una oportunidad del pipeline. Si todavía no existe, creala aquí
            mismo (se pedirá el contacto).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>
            Oportunidad <span className="text-rose-600">*</span>
          </Label>
          <div className="flex gap-2">
            <Popover open={oppOpen} onOpenChange={setOppOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className="flex-1 justify-between font-normal"
                  aria-label="Seleccionar oportunidad"
                >
                  {selectedOpp ? (
                    <span className="truncate">
                      <span className="font-medium">{selectedOpp.code}</span> — {selectedOpp.title}{" "}
                      <span className="text-muted-foreground">({selectedOpp.clientName})</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Buscar oportunidad…</span>
                  )}
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por código, título o cliente…" />
                  <CommandList>
                    <CommandEmpty>
                      <div className="space-y-2 px-2 py-1 text-center">
                        <p className="text-xs text-muted-foreground">
                          No hay oportunidades que coincidan.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          className="w-full"
                          onClick={() => {
                            setOppOpen(false);
                            setNewOppOpen(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Crear oportunidad
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {allOpportunities.map((o) => (
                        <CommandItem
                          key={o.id}
                          value={`${o.code} ${o.title} ${o.clientName}`}
                          onSelect={() => selectOpportunity(o)}
                        >
                          <Check
                            className={cn(
                              "h-3.5 w-3.5",
                              oppId === o.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1 truncate">
                            <span className="font-medium">{o.code}</span> — {o.title}
                          </span>
                          <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                            {o.clientName}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button type="button" variant="outline" onClick={() => setNewOppOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nueva
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedOpp
              ? `Cliente: ${selectedOpp.clientName}. La cotización quedará atada a esta oportunidad.`
              : "Elegí una oportunidad existente o creá una nueva desde un contacto."}
          </p>
        </CardContent>
      </Card>

      {/* ── Datos del evento ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Datos del evento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-name">
              Nombre del evento <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="event-name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Ej.: Fiesta de Navidad Alimentos Mary"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Fecha del evento</Label>
              <DatePicker
                id="start-date"
                value={startDate}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={setStartDate}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="days-count"># días del evento</Label>
              <Input
                id="days-count"
                type="number"
                min={1}
                max={30}
                value={daysCount}
                onChange={(e) => setDaysCount(e.target.value)}
              />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={datesTentative}
                  onCheckedChange={(v) => setDatesTentative(v === true)}
                />
                Fechas tentativas
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-time">Hora inicio</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-time">Hora fin</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pax">Invitados (pax)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="pax"
                  type="number"
                  min={0}
                  value={pax}
                  onChange={(e) => setPax(e.target.value)}
                  placeholder="0"
                  className="w-24"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={paxApproximate}
                    onCheckedChange={(v) => setPaxApproximate(v === true)}
                  />
                  Aproximado
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Reservar salón (opcional) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reservar salón (opcional)</CardTitle>
          <CardDescription>
            Elegí uno o más salones: al crear la cotización se bloquearán de forma{" "}
            <b>tentativa</b> en el calendario para estas fechas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Popover open={spaceOpen} onOpenChange={setSpaceOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between font-normal"
                aria-label="Seleccionar salones"
              >
                {selectedSpaceIds.length > 0 ? (
                  <span>
                    {selectedSpaceIds.length} salón
                    {selectedSpaceIds.length === 1 ? "" : "es"} seleccionado
                    {selectedSpaceIds.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Seleccionar salón(es)…</span>
                )}
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar salón…" />
                <CommandList>
                  <CommandEmpty>No hay salones activos.</CommandEmpty>
                  <CommandGroup>
                    {spaces.map((s) => {
                      const sel = selectedSpaceIds.includes(s.id);
                      return (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() =>
                            setSelectedSpaceIds((cur) =>
                              sel ? cur.filter((x) => x !== s.id) : [...cur, s.id]
                            )
                          }
                        >
                          <Check className={cn("h-3.5 w-3.5", sel ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1 truncate">{s.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedSpaceIds.length > 0 && (
            <ul className="space-y-1.5">
              {selectedSpaceIds.map((id) => {
                const s = spaces.find((x) => x.id === id);
                const av = availability[id];
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {s?.name ?? "—"}
                    </span>
                    {!startDate ? (
                      <span className="text-xs text-muted-foreground">Indicá la fecha</span>
                    ) : checkingAvail || !av ? (
                      <span className="text-xs text-muted-foreground">Verificando…</span>
                    ) : av.status === "confirmed" ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-rose-600">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Ocupado (confirmado)
                      </span>
                    ) : av.status === "tentative" ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Tentativa existente
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Disponible
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {selectedSpaceIds.length > 0 && !startDate && (
            <p className="text-xs text-amber-600">
              Sin fecha del evento no se puede reservar el salón.
            </p>
          )}
          {Object.values(availability).some((a) => a.status === "confirmed") && (
            <p className="text-xs text-rose-600">
              Los salones ocupados (confirmados) no se reservarán; el resto sí. Elegí otra fecha u
              otro salón si necesitás ese espacio.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" asChild>
          <Link href="/cotizaciones">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FilePlus2 className="h-3.5 w-3.5" />
          )}
          {isPending ? "Creando…" : "Crear borrador"}
        </Button>
      </div>

      {/* Crear oportunidad (desde un contacto) sin salir del cotizador */}
      <NewOpportunityForQuoteDialog
        open={newOppOpen}
        onOpenChange={setNewOppOpen}
        contacts={contacts}
        clients={clients}
        eventTypes={eventTypes}
        channels={channels}
        initialTitle={eventName}
        initialDate={startDate}
        initialPax={pax}
        preselectedContactId={preselectedContactId}
        onCreated={onOpportunityCreated}
      />
    </form>
  );
}
