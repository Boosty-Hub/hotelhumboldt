"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronsUpDown, Check, Loader2, ArrowLeft, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createQuote } from "@/app/(app)/cotizaciones/actions";

export interface OppOption {
  id: string;
  code: string;
  title: string;
  clientName: string;
  expectedEventDate: string | null; // yyyy-MM-dd
  pax: number | null;
}

export interface ClientOption {
  id: string;
  legalName: string;
  brandName: string | null;
}

interface Props {
  opportunities: OppOption[];
  clients: ClientOption[];
  preselectedOpportunityId: string | null;
}

export function NewQuoteForm({ opportunities, clients, preselectedOpportunityId }: Props) {
  const [isPending, startTransition] = useTransition();

  const preselected = opportunities.find((o) => o.id === preselectedOpportunityId) ?? null;

  const [mode, setMode] = useState<"oportunidad" | "cliente">(
    preselected || opportunities.length > 0 ? "oportunidad" : "cliente"
  );
  const [oppId, setOppId] = useState<string | null>(preselected?.id ?? null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [oppOpen, setOppOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);

  const [eventName, setEventName] = useState(preselected?.title ?? "");
  const [startDate, setStartDate] = useState(preselected?.expectedEventDate ?? "");
  const [datesTentative, setDatesTentative] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pax, setPax] = useState(preselected?.pax != null ? String(preselected.pax) : "");
  const [paxApproximate, setPaxApproximate] = useState(false);
  const [daysCount, setDaysCount] = useState("1");

  const selectedOpp = opportunities.find((o) => o.id === oppId) ?? null;
  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  function selectOpportunity(opp: OppOption) {
    setOppId(opp.id);
    setOppOpen(false);
    // Prefill desde la oportunidad si los campos están vacíos
    if (!eventName.trim()) setEventName(opp.title);
    if (!startDate && opp.expectedEventDate) setStartDate(opp.expectedEventDate);
    if (!pax && opp.pax != null) setPax(String(opp.pax));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "oportunidad" && !oppId) {
      toast.error("Selecciona la oportunidad");
      return;
    }
    if (mode === "cliente" && !clientId) {
      toast.error("Selecciona el cliente");
      return;
    }
    if (eventName.trim().length < 3) {
      toast.error("Indica el nombre del evento (mínimo 3 caracteres)");
      return;
    }
    startTransition(async () => {
      const res = await createQuote({
        opportunityId: mode === "oportunidad" ? oppId ?? "" : "",
        clientId: mode === "cliente" ? clientId ?? "" : "",
        eventName: eventName.trim(),
        startDate,
        datesTentative,
        startTime,
        endTime,
        pax: pax ? Number(pax) : undefined,
        paxApproximate,
        daysCount: Number(daysCount) || 1,
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

      {/* ── Origen: oportunidad o cliente ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">¿Para quién es la cotización?</CardTitle>
          <CardDescription>
            Vincúlala a una oportunidad del pipeline o empieza desde cero con un cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList>
              <TabsTrigger value="oportunidad">Oportunidad existente</TabsTrigger>
              <TabsTrigger value="cliente">Desde cero (cliente)</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "oportunidad" ? (
            <Popover open={oppOpen} onOpenChange={setOppOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full justify-between font-normal"
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
                    <CommandEmpty>No hay oportunidades que coincidan.</CommandEmpty>
                    <CommandGroup>
                      {opportunities.map((o) => (
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
          ) : (
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full justify-between font-normal"
                  aria-label="Seleccionar cliente"
                >
                  {selectedClient ? (
                    <span className="truncate">
                      {selectedClient.legalName}
                      {selectedClient.brandName && (
                        <span className="text-muted-foreground"> · {selectedClient.brandName}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Buscar cliente…</span>
                  )}
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente…" />
                  <CommandList>
                    <CommandEmpty>No hay clientes que coincidan.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.legalName} ${c.brandName ?? ""}`}
                          onSelect={() => {
                            setClientId(c.id);
                            setClientOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "h-3.5 w-3.5",
                              clientId === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1 truncate">{c.legalName}</span>
                          {c.brandName && (
                            <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                              {c.brandName}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          {mode === "cliente" && (
            <p className="text-xs text-muted-foreground">
              Se creará automáticamente una oportunidad en etapa &quot;Propuesta&quot; a tu nombre.
            </p>
          )}
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
              <Input
                id="start-date"
                type="date"
                value={startDate}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setStartDate(e.target.value)}
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
    </form>
  );
}
