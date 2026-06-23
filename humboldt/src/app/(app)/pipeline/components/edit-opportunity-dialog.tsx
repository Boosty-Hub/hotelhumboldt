"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { updateOpportunity } from "../actions";
import type { BasicUser, PipelineOpportunity } from "../types";

interface EditForm {
  title: string;
  eventType: string;
  segment: string;
  channel: string;
  expectedEventDate: Date | undefined;
  pax: string;
  estimatedValue: string;
  roomsCount: string;
  vgCount: string;
  ownerId: string;
}

function fromOpp(opp: PipelineOpportunity): EditForm {
  return {
    title: opp.title,
    eventType: opp.eventType ?? "",
    segment: opp.segment ?? "",
    channel: opp.channel ?? "",
    expectedEventDate: opp.expectedEventDate ? new Date(opp.expectedEventDate) : undefined,
    pax: opp.pax != null ? String(opp.pax) : "",
    estimatedValue: opp.estimatedValue ? String(opp.estimatedValue) : "",
    roomsCount: String(opp.roomsCount ?? 0),
    vgCount: String(opp.vgCount ?? 0),
    ownerId: opp.ownerId,
  };
}

export function EditOpportunityDialog({
  open,
  onOpenChange,
  opp,
  users,
  eventTypes,
  channels,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opp: PipelineOpportunity | null;
  users: BasicUser[];
  eventTypes: string[];
  channels: string[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditForm | null>(opp ? fromOpp(opp) : null);
  const [dateOpen, setDateOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Recarga el formulario cuando cambia la oportunidad a editar.
  useEffect(() => {
    setForm(opp ? fromOpp(opp) : null);
  }, [opp?.id]);

  if (!opp || !form) return null;

  const set = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const submit = () => {
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
    const rooms = form.roomsCount.trim() === "" ? 0 : Number(form.roomsCount);
    const vg = form.vgCount.trim() === "" ? 0 : Number(form.vgCount);

    startTransition(async () => {
      const res = await updateOpportunity({
        id: opp.id,
        title: form.title.trim(),
        eventType: form.eventType || undefined,
        segment: form.segment || undefined,
        channel: form.channel || undefined,
        expectedEventDate: form.expectedEventDate,
        pax,
        estimatedValue,
        roomsCount: Number.isFinite(rooms) && rooms >= 0 ? Math.trunc(rooms) : 0,
        vgCount: Number.isFinite(vg) && vg >= 0 ? Math.trunc(vg) : 0,
        ownerId: form.ownerId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Oportunidad actualizada");
      onSaved();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar oportunidad</DialogTitle>
          <DialogDescription>
            {opp.code} · {opp.client.brandName ?? opp.client.legalName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Título *</Label>
            <Input
              id="edit-title"
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

          {/* Segmento */}
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
                    onSelect={(date) => {
                      set("expectedEventDate", date ?? undefined);
                      setDateOpen(false);
                    }}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-pax">Pax</Label>
              <Input
                id="edit-pax"
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

          {/* Valor + responsable */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-value">Valor estimado (USD)</Label>
              <Input
                id="edit-value"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.estimatedValue}
                onChange={(e) => set("estimatedValue", e.target.value)}
                placeholder="0,00"
              />
              {opp.quotes.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Con cotización, el valor sigue a la cotización vigente.
                </p>
              )}
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

          {/* Habitaciones + VG teleférico */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-rooms">Habitaciones</Label>
              <Input
                id="edit-rooms"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={form.roomsCount}
                onChange={(e) => set("roomsCount", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-vg">VG teleférico</Label>
              <Input
                id="edit-vg"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={form.vgCount}
                onChange={(e) => set("vgCount", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="bg-sky-950 hover:bg-sky-900" disabled={pending} onClick={submit}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
