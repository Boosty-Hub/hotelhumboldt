"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createContactAction,
  deleteContactAction,
  setPrimaryContactAction,
  updateContactAction,
} from "../../actions";
import { initials } from "../../_lib/shared";

export interface ContactItem {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

interface ContactForm {
  name: string;
  title: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

const EMPTY_FORM: ContactForm = {
  name: "",
  title: "",
  phone: "",
  email: "",
  isPrimary: false,
};

export function ContactsCard({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: ContactItem[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContactItem | null>(null);
  const [deleting, setDeleting] = useState<ContactItem | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, isPrimary: contacts.length === 0 });
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(contact: ContactItem) {
    setEditing(contact);
    setForm({
      name: contact.name,
      title: contact.title ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      isPrimary: contact.isPrimary,
    });
    setErrors({});
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = editing
        ? await updateContactAction(editing.id, form)
        : await createContactAction(clientId, form);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Contacto actualizado" : "Contacto agregado");
      setDialogOpen(false);
    });
  }

  function handleSetPrimary(contact: ContactItem) {
    startTransition(async () => {
      const res = await setPrimaryContactAction(contact.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${contact.name} es ahora el contacto principal`);
    });
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteContactAction(deleting.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Contacto eliminado");
      setDeleting(null);
    });
  }

  const err = (key: string) =>
    errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contactos</CardTitle>
        <CardDescription>
          {contacts.length === 1
            ? "1 contacto registrado"
            : `${contacts.length} contactos registrados`}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Agregar
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <UsersRound className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Sin contactos. Agrega a la persona con quien coordinas el evento.
            </p>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus data-icon="inline-start" />
              Agregar contacto
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-muted text-[10px] font-semibold">
                    {initials(c.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.isPrimary ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        <Star className="size-2.5! fill-current" />
                        Principal
                      </Badge>
                    ) : null}
                  </div>
                  {c.title ? (
                    <p className="text-xs text-muted-foreground">{c.title}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {c.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </span>
                    ) : null}
                    {c.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </span>
                    ) : null}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Acciones de ${c.name}`}
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </DropdownMenuItem>
                    {!c.isPrimary ? (
                      <DropdownMenuItem onSelect={() => handleSetPrimary(c)}>
                        <Star className="h-3.5 w-3.5" />
                        Marcar como principal
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleting(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Dialog crear/editar contacto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar contacto" : "Nuevo contacto"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Actualiza los datos del contacto."
                : "Agrega una persona de contacto para este cliente."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="María Pérez"
                autoFocus
                required
              />
              {err("name")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-title">Cargo</Label>
              <Input
                id="contact-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Gerente de RRHH"
              />
              {err("title")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">Teléfono</Label>
                <Input
                  id="contact-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="0414-555-0000"
                />
                {err("phone")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Correo</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="mperez@empresa.com"
                />
                {err("email")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="contact-primary"
                checked={form.isPrimary}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isPrimary: checked === true }))
                }
              />
              <Label htmlFor="contact-primary" className="text-xs">
                Contacto principal del cliente
              </Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? "Guardar cambios" : "Agregar contacto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación eliminar contacto */}
      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleting?.name}» de la lista de contactos del
              cliente. Las oportunidades asociadas no se verán afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
