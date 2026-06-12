"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { saveSpace, deleteSpace } from "./actions";
import { SPACE_COLOR_PALETTE, type SpaceDTO } from "./types";

interface SpaceDialogProps {
  space?: SpaceDTO;
  /** Cantidad de salones existentes — sugiere el orden del nuevo salón. */
  nextSortOrder?: number;
}

interface FormState {
  name: string;
  dailyRate: string;
  halfDayRate: string;
  capacity: string;
  capacityNotes: string;
  description: string;
  color: string;
  active: boolean;
  sortOrder: string;
}

function initialState(space?: SpaceDTO, nextSortOrder = 0): FormState {
  return {
    name: space?.name ?? "",
    dailyRate: space?.dailyRate != null ? String(space.dailyRate) : "",
    halfDayRate: space?.halfDayRate != null ? String(space.halfDayRate) : "",
    capacity: space?.capacity != null ? String(space.capacity) : "",
    capacityNotes: space?.capacityNotes ?? "",
    description: space?.description ?? "",
    color: space?.color ?? SPACE_COLOR_PALETTE[0].value,
    active: space?.active ?? true,
    sortOrder: String(space?.sortOrder ?? nextSortOrder),
  };
}

function parseNullableNumber(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

export function SpaceDialog({ space, nextSortOrder }: SpaceDialogProps) {
  const isEdit = Boolean(space);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => initialState(space, nextSortOrder));
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setForm(initialState(space, nextSortOrder));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveSpace({
        id: space?.id,
        name: form.name,
        dailyRate: parseNullableNumber(form.dailyRate),
        halfDayRate: parseNullableNumber(form.halfDayRate),
        capacity: form.capacity.trim() === "" ? null : Math.trunc(Number(form.capacity)),
        capacityNotes: form.capacityNotes.trim() || null,
        description: form.description.trim() || null,
        color: form.color,
        active: form.active,
        sortOrder: form.sortOrder.trim() === "" ? 0 : Math.trunc(Number(form.sortOrder)),
      });
      if (res.ok) {
        toast.success(isEdit ? "Salón actualizado." : "Salón creado.");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete() {
    if (!space) return;
    startDelete(async () => {
      const res = await deleteSpace(space.id);
      if (res.ok) {
        toast.success("Salón eliminado.");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${space?.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" />
            Nuevo salón
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar salón" : "Nuevo salón"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifique los datos del salón. Los cambios se reflejan en el calendario."
              : "Registre un nuevo espacio para eventos del hotel."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="space-name">Nombre *</Label>
            <Input
              id="space-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ej. Bar Mirador (PH)"
              required
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="space-daily">Tarifa por día (USD)</Label>
              <Input
                id="space-daily"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.dailyRate}
                onChange={(e) => set("dailyRate", e.target.value)}
                placeholder="Sin tarifa"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="space-half">Media jornada (USD)</Label>
              <Input
                id="space-half"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.halfDayRate}
                onChange={(e) => set("halfDayRate", e.target.value)}
                placeholder="Sin tarifa"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="space-capacity">Capacidad (pax)</Label>
              <Input
                id="space-capacity"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={form.capacity}
                onChange={(e) => set("capacity", e.target.value)}
                placeholder="Por definir"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="space-order">Orden</Label>
              <Input
                id="space-order"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="space-capnotes">Notas de capacidad</Label>
            <Input
              id="space-capnotes"
              value={form.capacityNotes}
              onChange={(e) => set("capacityNotes", e.target.value)}
              placeholder="Ej. Usado también como camerino"
              maxLength={300}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="space-desc">Descripción</Label>
            <Textarea
              id="space-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Características del espacio, vista, equipamiento…"
              rows={3}
              maxLength={600}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color en el calendario</Label>
            <div className="flex flex-wrap gap-2">
              {SPACE_COLOR_PALETTE.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => set("color", c.value)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform hover:scale-110",
                    form.color === c.value
                      ? "border-foreground ring-2 ring-ring/40 scale-110"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <Label htmlFor="space-active">Salón activo</Label>
              <p className="text-[11px] text-muted-foreground">
                Los salones inactivos no aparecen en el calendario.
              </p>
            </div>
            <Switch
              id="space-active"
              checked={form.active}
              onCheckedChange={(v) => set("active", v)}
            />
          </div>

          <DialogFooter className="sm:justify-between">
            {isEdit ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={isDeleting}>
                    <Trash2 data-icon="inline-start" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar este salón?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará “{space?.name}” de forma permanente. Esta acción no se puede
                      deshacer. Si el salón tiene reservas, no podrá eliminarse.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Eliminar salón
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear salón"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
