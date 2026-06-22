"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Plus,
  X,
} from "lucide-react";
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
import type { BasicClient, BasicUser } from "../types";

interface FormState {
  clientId: string;
  newClientName: string;
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
  users,
  eventTypes,
  channels,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: BasicClient[];
  users: BasicUser[];
  eventTypes: string[];
  channels: string[];
  currentUserId: string;
}) {
  const emptyForm: FormState = useMemo(
    () => ({
      clientId: "",
      newClientName: "",
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
  const [clientOpen, setClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedClient = clients.find((c) => c.id === form.clientId);

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (!next) setForm(emptyForm);
    onOpenChange(next);
  };

  const submit = () => {
    if (!form.clientId && !form.newClientName.trim()) {
      toast.error("Selecciona un cliente o crea uno nuevo");
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
        clientId: form.clientId || undefined,
        newClientName: form.clientId ? undefined : form.newClientName.trim() || undefined,
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
        setForm(emptyForm);
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
            Registra una nueva oportunidad en el pipeline. Se creará en la etapa «Nuevo».
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Cliente */}
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            {form.newClientName ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-sky-900/40 bg-sky-50 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-xs">
                  <Building2 className="size-3.5 shrink-0 text-sky-900" />
                  <span className="truncate">
                    Cliente nuevo: <span className="font-semibold">{form.newClientName}</span>
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => set("newClientName", "")}
                  aria-label="Quitar cliente nuevo"
                >
                  <X />
                </Button>
              </div>
            ) : (
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !selectedClient && "text-muted-foreground")}>
                      {selectedClient
                        ? (selectedClient.brandName ?? selectedClient.legalName)
                        : "Buscar cliente…"}
                    </span>
                    <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Razón social o marca…"
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="space-y-2 px-2 py-1 text-center">
                          <p className="text-xs text-muted-foreground">
                            No se encontró el cliente.
                          </p>
                          {clientSearch.trim().length >= 3 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                set("newClientName", clientSearch.trim());
                                set("clientId", "");
                                setClientOpen(false);
                                setClientSearch("");
                              }}
                            >
                              <Plus />
                              Crear «{clientSearch.trim()}»
                            </Button>
                          )}
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {clients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.legalName} ${c.brandName ?? ""}`}
                            onSelect={() => {
                              set("clientId", c.id === form.clientId ? "" : c.id);
                              setClientOpen(false);
                              setClientSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "size-3.5",
                                form.clientId === c.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">
                              {c.brandName ?? c.legalName}
                              {c.brandName && (
                                <span className="text-muted-foreground"> · {c.legalName}</span>
                              )}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {clientSearch.trim().length >= 3 && (
                        <CommandGroup forceMount>
                          <CommandItem
                            forceMount
                            value={`__crear__${clientSearch}`}
                            onSelect={() => {
                              set("newClientName", clientSearch.trim());
                              set("clientId", "");
                              setClientOpen(false);
                              setClientSearch("");
                            }}
                          >
                            <Plus className="size-3.5" />
                            Crear cliente «{clientSearch.trim()}»
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

          {/* Fecha + pax + valor */}
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
      </DialogContent>
    </Dialog>
  );
}
