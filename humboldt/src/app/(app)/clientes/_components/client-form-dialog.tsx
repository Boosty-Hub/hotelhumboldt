"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserRound } from "lucide-react";
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
import { createClientAction, updateClientAction } from "../actions";
import { CLIENT_TYPES, CLIENT_TYPE_LABELS, type ClientType } from "../_lib/shared";

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
}: {
  /** Si se pasa, el dialog edita; si no, crea. */
  client?: ClientFormData | null;
  children: React.ReactNode;
}) {
  const isEdit = Boolean(client);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => initialState(client));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(initialState(client));
      setErrors({});
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

    startTransition(async () => {
      const res = isEdit
        ? await updateClientAction(client!.id, base)
        : await createClientAction({
            ...base,
            contact: form.contactName.trim()
              ? {
                  name: form.contactName,
                  title: form.contactTitle,
                  phone: form.contactPhone,
                  email: form.contactEmail,
                }
              : undefined,
          });

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
                  Contacto principal (opcional)
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contactName">Nombre</Label>
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
