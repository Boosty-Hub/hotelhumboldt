"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Link2,
  Loader2,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Star,
  UserMinus,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  linkContactToClientAction,
  setPrimaryContactAction,
  unlinkContactAction,
  updateContactAction,
} from "../../actions";
import { initials } from "../../_lib/shared";

export interface ContactItem {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  /** Principal DE ESTE cliente. */
  isPrimary: boolean;
}

/** Contacto del catálogo global que aún no está vinculado a este cliente. */
export interface LinkableContact {
  id: string;
  name: string;
  title: string | null;
  /** Empresas a las que ya pertenece (para mostrar contexto). */
  clientNames: string[];
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
  linkable,
}: {
  clientId: string;
  contacts: ContactItem[];
  linkable: LinkableContact[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContactItem | null>(null);
  const [unlinking, setUnlinking] = useState<ContactItem | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // Vincular un contacto existente (libre o de otra empresa).
  const [linkOpen, setLinkOpen] = useState(false);
  const linkableSorted = useMemo(
    () => [...linkable].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [linkable]
  );

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
      if (editing) {
        const res = await updateContactAction(editing.id, form);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast.error(res.error);
          return;
        }
        // El "principal" es por-cliente: se ajusta aparte si cambió.
        if (form.isPrimary && !editing.isPrimary) {
          await setPrimaryContactAction(clientId, editing.id);
        }
        toast.success("Contacto actualizado");
      } else {
        const res = await createContactAction(clientId, form);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast.error(res.error);
          return;
        }
        toast.success("Contacto agregado");
      }
      setDialogOpen(false);
    });
  }

  function handleSetPrimary(contact: ContactItem) {
    startTransition(async () => {
      const res = await setPrimaryContactAction(clientId, contact.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${contact.name} es ahora el contacto principal`);
    });
  }

  function handleLink(contactId: string, name: string) {
    setLinkOpen(false);
    startTransition(async () => {
      const res = await linkContactToClientAction(clientId, contactId, contacts.length === 0);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name} vinculado al cliente`);
    });
  }

  function handleUnlink() {
    if (!unlinking) return;
    startTransition(async () => {
      const res = await unlinkContactAction(clientId, unlinking.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Contacto quitado del cliente");
      setUnlinking(null);
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
            ? "1 contacto vinculado"
            : `${contacts.length} contactos vinculados`}
        </CardDescription>
        <CardAction>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
              <Link2 data-icon="inline-start" />
              Vincular
            </Button>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus data-icon="inline-start" />
              Nuevo
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <UsersRound className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Sin contactos. Vinculá uno existente o creá uno nuevo.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
                <Link2 data-icon="inline-start" />
                Vincular existente
              </Button>
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus data-icon="inline-start" />
                Nuevo
              </Button>
            </div>
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
                      onSelect={() => setUnlinking(c)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Quitar del cliente
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
                : "Crea una persona y vinculala a este cliente."}
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
                Contacto principal de este cliente
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

      {/* Dialog vincular contacto existente */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular contacto existente</DialogTitle>
            <DialogDescription>
              Elegí un contacto del directorio (libre o de otra empresa). Seguirá perteneciendo
              a sus otras empresas.
            </DialogDescription>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Buscar contacto…" />
            <CommandList>
              <CommandEmpty>No hay contactos disponibles para vincular.</CommandEmpty>
              <CommandGroup>
                {linkableSorted.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.title ?? ""} ${c.clientNames.join(" ")}`}
                    onSelect={() => handleLink(c.id, c.name)}
                  >
                    <Check className="h-3.5 w-3.5 opacity-0" />
                    <span className="flex-1 truncate">
                      {c.name}
                      {c.title && <span className="text-muted-foreground"> · {c.title}</span>}
                    </span>
                    <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                      {c.clientNames.length === 0 ? "libre" : c.clientNames.join(", ")}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Confirmación quitar contacto del cliente */}
      <AlertDialog open={Boolean(unlinking)} onOpenChange={(o) => !o && setUnlinking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar este contacto del cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desvinculará «{unlinking?.name}» de este cliente. El contacto seguirá existiendo
              en el directorio y en sus otras empresas. Las oportunidades no se ven afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleUnlink();
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
