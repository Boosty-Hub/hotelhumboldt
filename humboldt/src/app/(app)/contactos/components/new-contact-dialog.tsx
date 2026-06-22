"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLIENT_TYPES, CLIENT_TYPE_LABELS } from "@/app/(app)/clientes/_lib/shared";
import { createWalkInContactAction } from "../actions";
import type { ClientLite } from "./contacts-view";

export interface CreatedContact {
  contactId: string;
  clientId: string;
  name: string;
  title: string | null;
  clientName: string;
}

export function NewContactDialog({
  open,
  onOpenChange,
  clients,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: ClientLite[];
  /** Si se provee, el alta se queda en la página (no redirige) y devuelve el contacto creado. */
  onCreated?: (c: CreatedContact) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [rif, setRif] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [clientMode, setClientMode] = useState<"existente" | "nuevo">(
    clients.length > 0 ? "existente" : "nuevo"
  );
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientType, setNewClientType] = useState<string>("PERSONA");

  function reset() {
    setName("");
    setTitle("");
    setPhone("");
    setEmail("");
    setRif("");
    setReferredBy("");
    setNotes("");
    setClientId("");
    setNewClientName("");
    setNewClientType("PERSONA");
  }

  function submit(thenQuote: boolean) {
    if (name.trim().length < 2) {
      toast.error("Escribí el nombre del contacto.");
      return;
    }
    if (clientMode === "existente" && !clientId) {
      toast.error("Elegí un cliente existente.");
      return;
    }
    if (clientMode === "nuevo" && newClientName.trim().length < 2) {
      toast.error("Escribí la razón social del cliente nuevo.");
      return;
    }
    startTransition(async () => {
      const res = await createWalkInContactAction({
        name,
        title,
        phone,
        email,
        rif,
        referredBy,
        notes,
        clientId: clientMode === "existente" ? clientId : undefined,
        newClientName: clientMode === "nuevo" ? newClientName : undefined,
        newClientType: clientMode === "nuevo" ? newClientType : undefined,
      });
      if (res.ok) {
        toast.success("Contacto guardado.");
        if (onCreated) {
          const clientName =
            clientMode === "nuevo"
              ? newClientName.trim()
              : clients.find((c) => c.id === clientId)?.name ?? "";
          onCreated({
            contactId: res.contactId,
            clientId: res.clientId,
            name: name.trim(),
            title: title.trim() || null,
            clientName,
          });
          reset();
          onOpenChange(false);
          return;
        }
        reset();
        onOpenChange(false);
        if (thenQuote) router.push(`/cotizaciones/nueva?contacto=${res.contactId}`);
        else router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar contacto</DialogTitle>
          <DialogDescription>
            Para un walk-in que no está en el sistema, podés crear el cliente nuevo al vuelo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Nombre *</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido"
              disabled={pending}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-title">Cargo</Label>
              <Input
                id="c-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Gerente"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Teléfono</Label>
              <Input
                id="c-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">Correo</Label>
            <Input
              id="c-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-rif">RIF (opcional)</Label>
              <Input
                id="c-rif"
                value={rif}
                onChange={(e) => setRif(e.target.value)}
                placeholder="J-12345678-9"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-ref">Referido por (opcional)</Label>
              <Input
                id="c-ref"
                value={referredBy}
                onChange={(e) => setReferredBy(e.target.value)}
                placeholder="Quién lo refirió"
                disabled={pending}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-notes">Notas (opcional)</Label>
            <Textarea
              id="c-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle del pedido, contexto del walk-in…"
              className="min-h-16 text-xs"
              disabled={pending}
            />
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Label>Cliente</Label>
            <Tabs value={clientMode} onValueChange={(v) => setClientMode(v as "existente" | "nuevo")}>
              <TabsList>
                <TabsTrigger value="existente" disabled={clients.length === 0}>
                  Existente
                </TabsTrigger>
                <TabsTrigger value="nuevo">Nuevo (walk-in)</TabsTrigger>
              </TabsList>
            </Tabs>
            {clientMode === "existente" ? (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Razón social / nombre"
                  disabled={pending}
                />
                <Select value={newClientType} onValueChange={setNewClientType}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CLIENT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {onCreated ? (
            <Button
              onClick={() => submit(false)}
              disabled={pending}
              className="bg-sky-950 hover:bg-sky-900"
            >
              {pending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <UserPlus data-icon="inline-start" />
              )}
              Guardar contacto
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => submit(false)} disabled={pending}>
                {pending ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <UserPlus data-icon="inline-start" />
                )}
                Guardar
              </Button>
              <Button
                onClick={() => submit(true)}
                disabled={pending}
                className="bg-sky-950 hover:bg-sky-900"
              >
                <FileText data-icon="inline-start" />
                Guardar y cotizar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
