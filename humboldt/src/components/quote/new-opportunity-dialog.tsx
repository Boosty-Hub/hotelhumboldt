"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { SELECTABLE_SEGMENTS } from "@/lib/segments";
import {
  createOpportunityForQuote,
  type NewOppOption,
} from "@/app/(app)/cotizaciones/actions";
import { NewContactDialog } from "@/app/(app)/contactos/components/new-contact-dialog";
import type { ContactPickOption, ClientOption } from "./new-quote-form";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactPickOption[];
  clients: ClientOption[];
  eventTypes: string[];
  channels: string[];
  /** Valores iniciales tomados del formulario de cotización (si ya los tipeó). */
  initialTitle?: string;
  initialDate?: string; // yyyy-MM-dd
  initialPax?: string;
  preselectedContactId?: string | null;
  onCreated: (opp: NewOppOption) => void;
}

const clientLabel = (c: ClientOption) => c.brandName ?? c.legalName;

export function NewOpportunityForQuoteDialog({
  open,
  onOpenChange,
  contacts,
  clients,
  eventTypes,
  channels,
  initialTitle = "",
  initialDate = "",
  initialPax = "",
  preselectedContactId = null,
  onCreated,
}: Props) {
  const [pending, startTransition] = useTransition();

  // Contactos creados al vuelo en esta sesión del diálogo.
  const [extraContacts, setExtraContacts] = useState<ContactPickOption[]>([]);
  const [contactId, setContactId] = useState<string | null>(preselectedContactId);
  const [contactOpen, setContactOpen] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);

  // Empresa (cliente) de la oportunidad — se elige aparte porque un contacto
  // puede pertenecer a 0, 1 o varias empresas.
  const [clientId, setClientId] = useState<string>("");
  const [clientOpen, setClientOpen] = useState(false);

  const [title, setTitle] = useState(initialTitle);
  const [eventType, setEventType] = useState("");
  const [segment, setSegment] = useState("");
  const [channel, setChannel] = useState("");
  const [expectedDate, setExpectedDate] = useState(initialDate);
  const [pax, setPax] = useState(initialPax);
  const [estimatedValue, setEstimatedValue] = useState("");

  const allContacts = useMemo(
    () => [...contacts, ...extraContacts],
    [contacts, extraContacts]
  );
  const selectedContact = allContacts.find((c) => c.id === contactId) ?? null;
  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  // Al elegir un contacto, prefill la empresa si tiene exactamente una.
  function pickContact(ct: ContactPickOption) {
    setContactId(ct.id);
    setContactOpen(false);
    if (ct.clients.length === 1) setClientId(ct.clients[0].id);
    else if (!ct.clients.some((c) => c.id === clientId)) setClientId("");
  }

  const submit = () => {
    if (!contactId) {
      toast.error("Selecciona o creá el contacto");
      return;
    }
    if (title.trim().length < 3) {
      toast.error("El título debe tener al menos 3 caracteres");
      return;
    }
    startTransition(async () => {
      const res = await createOpportunityForQuote({
        contactId,
        clientId: clientId || undefined,
        title: title.trim(),
        eventType: eventType || undefined,
        segment: segment || undefined,
        channel: channel || undefined,
        expectedEventDate: expectedDate || undefined,
        pax: pax ? Number(pax) : undefined,
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Oportunidad ${res.opportunity.code} creada`);
      onCreated(res.opportunity);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva oportunidad</DialogTitle>
          <DialogDescription>
            Elegí el contacto (si no existe, creálo) y la empresa para la que es la
            oportunidad. Un contacto puede pertenecer a varias empresas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
          {/* Contacto (obligatorio) */}
          <div className="space-y-1.5">
            <Label>
              Contacto <span className="text-rose-600">*</span>
            </Label>
            <div className="flex gap-2">
              <Popover open={contactOpen} onOpenChange={setContactOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="flex-1 justify-between font-normal"
                    aria-label="Seleccionar contacto"
                  >
                    {selectedContact ? (
                      <span className="truncate">{selectedContact.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Buscar contacto…</span>
                    )}
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por contacto o empresa…" />
                    <CommandList>
                      <CommandEmpty>No hay contactos que coincidan.</CommandEmpty>
                      <CommandGroup>
                        {allContacts.map((ct) => (
                          <CommandItem
                            key={ct.id}
                            value={`${ct.name} ${ct.title ?? ""} ${ct.clients
                              .map((c) => c.name)
                              .join(" ")}`}
                            onSelect={() => pickContact(ct)}
                          >
                            <Check
                              className={cn(
                                "h-3.5 w-3.5",
                                contactId === ct.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1 truncate">
                              {ct.name}
                              {ct.title && (
                                <span className="text-muted-foreground"> · {ct.title}</span>
                              )}
                            </span>
                            <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                              {ct.clients.length === 0
                                ? "sin empresa"
                                : ct.clients.map((c) => c.name).join(", ")}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button type="button" variant="outline" onClick={() => setNewContactOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                Nuevo
              </Button>
            </div>
          </div>

          {/* Empresa (cliente) — opcional */}
          <div className="space-y-1.5">
            <Label>Empresa (cliente) (opcional)</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className="w-full justify-between font-normal"
                  aria-label="Seleccionar empresa"
                >
                  {selectedClient ? (
                    <span className="truncate">{clientLabel(selectedClient)}</span>
                  ) : (
                    <span className="text-muted-foreground">Buscar empresa…</span>
                  )}
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar empresa…" />
                  <CommandList>
                    <CommandEmpty>No hay empresas que coincidan.</CommandEmpty>
                    {selectedContact && selectedContact.clients.length > 0 && (
                      <CommandGroup heading="Empresas del contacto">
                        {selectedContact.clients.map((c) => (
                          <CommandItem
                            key={`own-${c.id}`}
                            value={`own ${c.name}`}
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
                            <span className="truncate">{c.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    <CommandGroup heading="Todas las empresas">
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={clientLabel(c)}
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
                          <span className="truncate">
                            {clientLabel(c)}
                            {c.brandName && (
                              <span className="text-muted-foreground"> · {c.legalName}</span>
                            )}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedContact && selectedContact.clients.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Este contacto no tiene empresa. Podés dejarlo sin empresa o elegir una.
              </p>
            )}
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="opq-title">
              Título <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="opq-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej.: Fiesta de Navidad Alimentos Mary"
            />
          </div>

          {/* Tipo de evento + canal */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de evento</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Segmento */}
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Corporativo · Institucional · Social" />
              </SelectTrigger>
              <SelectContent>
                {SELECTABLE_SEGMENTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha + pax + valor */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="opq-date">Fecha evento esperada</Label>
              <DatePicker
                id="opq-date"
                value={expectedDate}
                onChange={setExpectedDate}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opq-pax">Pax</Label>
              <Input
                id="opq-pax"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={pax}
                onChange={(e) => setPax(e.target.value)}
                placeholder="Ej.: 120"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opq-value">Valor (USD)</Label>
              <Input
                id="opq-value"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="bg-sky-950 hover:bg-sky-900" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {pending ? "Creando…" : "Crear oportunidad"}
          </Button>
        </DialogFooter>

        {/* Crear contacto (libre o con empresa) sin salir del diálogo */}
        <NewContactDialog
          open={newContactOpen}
          onOpenChange={setNewContactOpen}
          clients={clients.map((c) => ({ id: c.id, name: clientLabel(c) }))}
          onCreated={(c) => {
            const ctClients =
              c.clientId && c.clientName ? [{ id: c.clientId, name: c.clientName }] : [];
            setExtraContacts((cur) => [
              ...cur,
              { id: c.contactId, name: c.name, title: c.title, clients: ctClients },
            ]);
            setContactId(c.contactId);
            if (ctClients.length === 1) setClientId(ctClients[0].id);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
