"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { createClientAction, updateClientAction } from "../actions";
import { CLIENT_TYPES, CLIENT_TYPE_LABELS, type ClientType } from "../_lib/shared";

/** Contacto del directorio para elegir al crear el cliente. */
export interface ContactPickLite {
  id: string;
  name: string;
  title: string | null;
  clientNames: string[];
}

export interface ClientFormData {
  id: string;
  legalName: string;
  brandName: string | null;
  rif: string | null;
  type: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface FormState {
  legalName: string;
  brandName: string;
  rif: string;
  type: ClientType;
  address: string;
  phone: string;
  email: string;
  notes: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  contactEmail: string;
}

function initialState(client?: ClientFormData | null): FormState {
  return {
    legalName: client?.legalName ?? "",
    brandName: client?.brandName ?? "",
    rif: client?.rif ?? "",
    type: (CLIENT_TYPES as readonly string[]).includes(client?.type ?? "")
      ? (client!.type as ClientType)
      : "EMPRESA",
    address: client?.address ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: client?.notes ?? "",
    contactName: "",
    contactTitle: "",
    contactPhone: "",
    contactEmail: "",
  };
}

export function ClientFormDialog({
  client,
  children,
  contacts = [],
}: {
  /** Si se pasa, el dialog edita; si no, crea. */
  client?: ClientFormData | null;
  children: React.ReactNode;
  /** Contactos del directorio para vincular al crear (solo modo crear). */
  contacts?: ContactPickLite[];
}) {
  const isEdit = Boolean(client);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => initialState(client));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // Contacto principal al crear: elegir uno existente o crear uno nuevo.
  const [contactMode, setContactMode] = useState<"existente" | "nuevo">(
    contacts.length > 0 ? "existente" : "nuevo"
  );
  const [contactId, setContactId] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const selectedContact = contacts.find((c) => c.id === contactId) ?? null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(initialState(client));
      setErrors({});
      setContactMode(contacts.length > 0 ? "existente" : "nuevo");
      setContactId("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const base = {
      legalName: form.legalName,
      brandName: form.brandName,
      rif: form.rif,
      type: form.type,
      address: form.address,
      phone: form.phone,
      email: form.email,
      notes: form.notes,
    };

    // Al crear, el contacto es obligatorio: un cliente nace vinculado a una
    // persona del directorio (existente o nueva).
    if (!isEdit) {
      if (contactMode === "existente" && !contactId) {
        toast.error("Elegí un contacto existente o creá uno nuevo.");
        return;
      }
      if (contactMode === "nuevo" && form.contactName.trim().length < 2) {
        setErrors({ "contact.name": "El contacto es obligatorio (mínimo 2 caracteres)." });
        toast.error("Registra el contacto del cliente.");
        return;
      }
    }

    const contactPayload =
      contactMode === "existente"
        ? { contactId }
        : {
            name: form.contactName,
            title: form.contactTitle,
            phone: form.contactPhone,
            email: form.contactEmail,
          };

    startTransition(async () => {
      const res = isEdit
        ? await updateClientAction(client!.id, base)
        : await createClientAction({ ...base, contact: contactPayload });

      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }

      toast.success(isEdit ? "Cliente actualizado" : "Cliente creado");
      setOpen(false);
      if (!isEdit && res.id) router.push(`/clientes/${res.id}`);
    });
  }

  const err = (key: string) =>
    errors[key] ? (
      <p className="text-xs text-destructive">{errors[key]}</p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos del cliente."
              : "Registra una empresa o persona para cotizarle eventos."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="legalName">
                Razón social <span className="text-destructive">*</span>
              </Label>
              <Input
                id="legalName"
                value={form.legalName}
                onChange={(e) => set("legalName", e.target.value)}
                placeholder="IANCARINA C.A."
                autoFocus
                required
              />
              {err("legalName")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brandName">Marca comercial</Label>
              <Input
                id="brandName"
                value={form.brandName}
                onChange={(e) => set("brandName", e.target.value)}
                placeholder="Alimentos Mary"
              />
              {err("brandName")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rif">RIF</Label>
              <Input
                id="rif"
                value={form.rif}
                onChange={(e) => set("rif", e.target.value)}
                placeholder="J-08503328-9"
              />
              {err("rif")}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de cliente</Label>
              <Select
                value={form.type}
                onValueChange={(v) => set("type", v as ClientType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CLIENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err("type")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="0212-555-0000"
              />
              {err("phone")}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="contacto@empresa.com"
              />
              {err("email")}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Dirección</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Av. Principal, Caracas"
                rows={2}
              />
              {err("address")}
            </div>

            {isEdit ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notas internas</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Observaciones generales del cliente"
                  rows={2}
                />
                {err("notes")}
              </div>
            ) : null}
          </div>

          {!isEdit ? (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" />
                  Contacto principal <span className="text-destructive">*</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Vinculá un contacto del directorio (libre o de otra empresa) o creá uno nuevo.
                </p>

                <Tabs
                  value={contactMode}
                  onValueChange={(v) => setContactMode(v as "existente" | "nuevo")}
                >
                  <TabsList>
                    <TabsTrigger value="existente" disabled={contacts.length === 0}>
                      Existente
                    </TabsTrigger>
                    <TabsTrigger value="nuevo">Nuevo</TabsTrigger>
                  </TabsList>
                </Tabs>

                {contactMode === "existente" ? (
                  <Popover open={contactOpen} onOpenChange={setContactOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal"
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
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Buscar por nombre o empresa…" />
                        <CommandList>
                          <CommandEmpty>No hay contactos que coincidan.</CommandEmpty>
                          <CommandGroup>
                            {contacts.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.name} ${c.title ?? ""} ${c.clientNames.join(" ")}`}
                                onSelect={() => {
                                  setContactId(c.id);
                                  setContactOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "h-3.5 w-3.5",
                                    contactId === c.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="flex-1 truncate">
                                  {c.name}
                                  {c.title && (
                                    <span className="text-muted-foreground"> · {c.title}</span>
                                  )}
                                </span>
                                <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                                  {c.clientNames.length === 0
                                    ? "libre"
                                    : c.clientNames.join(", ")}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="contactName">
                        Nombre <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contactName"
                        value={form.contactName}
                        onChange={(e) => set("contactName", e.target.value)}
                        placeholder="María Pérez"
                      />
                      {err("contact.name")}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contactTitle">Cargo</Label>
                      <Input
                        id="contactTitle"
                        value={form.contactTitle}
                        onChange={(e) => set("contactTitle", e.target.value)}
                        placeholder="Gerente de RRHH"
                      />
                      {err("contact.title")}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contactPhone">Teléfono</Label>
                      <Input
                        id="contactPhone"
                        value={form.contactPhone}
                        onChange={(e) => set("contactPhone", e.target.value)}
                        placeholder="0414-555-0000"
                      />
                      {err("contact.phone")}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contactEmail">Correo</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={form.contactEmail}
                        onChange={(e) => set("contactEmail", e.target.value)}
                        placeholder="mperez@empresa.com"
                      />
                      {err("contact.email")}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
