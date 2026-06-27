"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronsUpDown, UserPlus } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { SELECTABLE_SEGMENTS } from "@/lib/segments";
import { createOpportunity } from "../actions";
import type { BasicClient, BasicContact, BasicUser } from "../types";
import { NewContactDialog } from "@/app/(app)/contactos/components/new-contact-dialog";

interface FormState {
  title: string;
  eventType: string;
  segment: string;
  channel: string;
  expectedEventDate: Date | undefined;
  pax: string;
  estimatedValue: string;
  ownerId: string;
}

export function NewOpportunityDialog({
  open,
  onOpenChange,
  clients,
  contacts,
  users,
  eventTypes,
  channels,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: BasicClient[];
  contacts: BasicContact[];
  users: BasicUser[];
  eventTypes: string[];
  channels: string[];
  currentUserId: string;
}) {
  const emptyForm: FormState = useMemo(
    () => ({
      title: "",
      eventType: "",
      segment: "",
      channel: "",
      expectedEventDate: undefined,
      pax: "",
      estimatedValue: "",
      ownerId: users.some((u) => u.id === currentUserId) ? currentUserId : "",
    }),
    [users, currentUserId]
  );

  const [form, setForm] = useState<FormState>(emptyForm);
  // Contacto (obligatorio) y empresa (campo aparte: un contacto puede tener varias).
  const [extraContacts, setExtraContacts] = useState<BasicContact[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [contactOpen, setContactOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const allContacts = useMemo(() => [...contacts, ...extraContacts], [contacts, extraContacts]);
  const selectedContact = allContacts.find((c) => c.id === contactId) ?? null;
  const clientLabel = (c: BasicClient) => c.brandName ?? c.legalName;
  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  function pickContact(ct: BasicContact) {
    setContactId(ct.id);
    setContactOpen(false);
    if (ct.clients.length === 1) setClientId(ct.clients[0].id);
    else if (!ct.clients.some((c) => c.id === clientId)) setClientId("");
  }

  const resetAll = () => {
    setForm(emptyForm);
    setContactId(null);
    setClientId("");
    setExtraContacts([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (!next) resetAll();
    onOpenChange(next);
  };

  const submit = () => {
    if (!contactId) {
      toast.error("Selecciona o creá el contacto");
      return;
    }
    if (form.title.trim().length < 3) {
      toast.error("El título debe tener al menos 3 caracteres");
      return;
    }
    if (!form.ownerId) {
      toast.error("Selecciona un responsable");
      return;
    }
    const pax = form.pax.trim() === "" ? undefined : Number(form.pax);
    if (pax !== undefined && (!Number.isInteger(pax) || pax <= 0)) {
      toast.error("Pax debe ser un número entero mayor que cero");
      return;
    }
    const estimatedValue =
      form.estimatedValue.trim() === "" ? undefined : Number(form.estimatedValue);
    if (estimatedValue !== undefined && (Number.isNaN(estimatedValue) || estimatedValue < 0)) {
      toast.error("El valor estimado debe ser un número positivo");
      return;
    }

    startTransition(async () => {
      const res = await createOpportunity({
        contactId,
        clientId: clientId || undefined,
        title: form.title.trim(),
        eventType: form.eventType || undefined,
        segment: form.segment || undefined,
        channel: form.channel || undefined,
        expectedEventDate: form.expectedEventDate,
        pax,
        estimatedValue,
        ownerId: form.ownerId,
      });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Oportunidad creada");
        resetAll();
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva oportunidad</DialogTitle>
          <DialogDescription>
            Elegí el contacto (si no existe, creálo) y la empresa para la que es. Se creará en la
            etapa «Nuevo».
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Contacto (obligatorio) */}
          <div className="space-y-1.5">
            <Label>Contacto *</Label>
            <div className="flex gap-2">
              <Popover open={contactOpen} onOpenChange={setContactOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="flex-1 justify-between font-normal"
                  >
                    <span className={cn("truncate", !selectedContact && "text-muted-foreground")}>
                      {selectedContact ? selectedContact.name : "Buscar contacto…"}
                    </span>
                    <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
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
                                "size-3.5",
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
                <UserPlus className="size-3.5" />
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
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className={cn("truncate", !selectedClient && "text-muted-foreground")}>
                    {selectedClient ? clientLabel(selectedClient) : "Buscar empresa…"}
                  </span>
                  <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
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
                                "size-3.5",
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
                              "size-3.5",
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
                Este contacto no tiene empresa. Podés dejarlo sin empresa o elegir una (quedará
                vinculado a ella).
              </p>
            )}
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="op-title">Título *</Label>
            <Input
              id="op-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ej.: Fiesta de Navidad Alimentos Mary"
            />
          </div>

          {/* Tipo de evento + canal */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de evento</Label>
              <Select value={form.eventType} onValueChange={(v) => set("eventType", v)}>
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
              <Select value={form.channel} onValueChange={(v) => set("channel", v)}>
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

          {/* Segmento comercial */}
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Select value={form.segment} onValueChange={(v) => set("segment", v)}>
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

          {/* Fecha + pax */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha evento esperada</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start font-normal",
                      !form.expectedEventDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="size-3.5" />
                    {form.expectedEventDate
                      ? format(form.expectedEventDate, "dd/MM/yyyy", { locale: es })
                      : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.expectedEventDate}
                    onSelect={(d) => {
                      set("expectedEventDate", d ?? undefined);
                      setDateOpen(false);
                    }}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-pax">Pax</Label>
              <Input
                id="op-pax"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={form.pax}
                onChange={(e) => set("pax", e.target.value)}
                placeholder="Ej.: 120"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="op-value">Valor estimado (USD)</Label>
              <Input
                id="op-value"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.estimatedValue}
                onChange={(e) => set("estimatedValue", e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Responsable *</Label>
              <Select value={form.ownerId} onValueChange={(v) => set("ownerId", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                      <span className="text-muted-foreground">
                        {" "}
                        · {ROLE_LABELS[u.role as Role] ?? u.role}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-sky-950 hover:bg-sky-900"
            disabled={pending}
            onClick={submit}
          >
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
