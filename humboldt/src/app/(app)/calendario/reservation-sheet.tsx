"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  Clock,
  ExternalLink,
  FileText,
  History,
  Pencil,
  StickyNote,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
  type ReservationStatus,
} from "@/lib/constants";
import {
  deleteReservation,
  getReservationLog,
  updateReservationDetails,
  updateReservationStatus,
  type ReservationLogEntry,
} from "./actions";
import { RESERVATION_STATUS_COLORS, type CalendarSpaceDTO, type ReservationDTO } from "./types";

const LOG_ACTION_LABELS: Record<string, string> = {
  CREADA: "Creada",
  MODIFICADA: "Modificada",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
  REACTIVADA: "Reactivada",
  ELIMINADA: "Eliminada",
};

const LOG_ACTION_BADGE: Record<string, string> = {
  CREADA: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MODIFICADA: "border-sky-200 bg-sky-50 text-sky-700",
  CONFIRMADA: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELADA: "border-rose-200 bg-rose-50 text-rose-700",
  REACTIVADA: "border-amber-200 bg-amber-50 text-amber-700",
  ELIMINADA: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

const LOG_ACTION_DOT: Record<string, string> = {
  CREADA: "#10b981",
  MODIFICADA: "#0ea5e9",
  CONFIRMADA: "#10b981",
  CANCELADA: "#f43f5e",
  REACTIVADA: "#f59e0b",
  ELIMINADA: "#71717a",
};

interface ReservationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: ReservationDTO | null;
  space: CalendarSpaceDTO | null;
  spaces: CalendarSpaceDTO[];
}

export function ReservationSheet({
  open,
  onOpenChange,
  reservation,
  space,
  spaces,
}: ReservationSheetProps) {
  const [pendingStatus, setPendingStatus] = useState<ReservationStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editSpaceId, setEditSpaceId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [logs, setLogs] = useState<ReservationLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  // Sale del modo edición al cambiar de reserva o cerrar el panel.
  useEffect(() => {
    setEditing(false);
  }, [reservation?.id, open]);

  // Carga el log de actividad al abrir la reserva.
  useEffect(() => {
    if (!open || !reservation) return;
    let cancelled = false;
    setLogLoading(true);
    getReservationLog(reservation.id)
      .then((entries) => {
        if (!cancelled) setLogs(entries);
      })
      .finally(() => {
        if (!cancelled) setLogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, reservation?.id]);

  if (!reservation) return null;
  const r = reservation;

  function startEdit() {
    setEditSpaceId(r.spaceId);
    setEditDate(r.dateKey);
    setEditStart(r.startTime ?? "");
    setEditEnd(r.endTime ?? "");
    setEditNotes(r.notes ?? "");
    setEditing(true);
  }

  function saveEdit() {
    if (!editSpaceId || !editDate) {
      toast.error("Salón y fecha son obligatorios.");
      return;
    }
    startTransition(async () => {
      const res = await updateReservationDetails({
        id: r.id,
        spaceId: editSpaceId,
        date: editDate,
        startTime: editStart || null,
        endTime: editEnd || null,
        notes: editNotes.trim() || null,
      });
      if (res.ok) {
        if (res.warning) toast.warning(res.warning, { duration: 8000 });
        toast.success(res.message ?? "Reserva actualizada.");
        setEditing(false);
        onOpenChange(false);
      } else {
        toast.error(res.error, { duration: 8000 });
      }
    });
  }

  function confirmStatusChange() {
    if (!pendingStatus) return;
    startTransition(async () => {
      const res = await updateReservationStatus(r.id, pendingStatus);
      if (res.ok) {
        toast.success(res.message ?? "Estado actualizado.");
        setPendingStatus(null);
        onOpenChange(false);
      } else {
        toast.error(res.error);
        setPendingStatus(null);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteReservation(r.id);
      if (res.ok) {
        toast.success(res.message ?? "Reserva eliminada.");
        setDeleteOpen(false);
        onOpenChange(false);
      } else {
        toast.error(res.error);
        setDeleteOpen(false);
      }
    });
  }

  const dateLabel = format(parseISO(r.dateKey), "dd/MM/yyyy", { locale: es });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md gap-0">
          <SheetHeader className="pb-2">
            <div className="flex items-center gap-2 pr-8">
              <SheetTitle className="truncate text-base">{r.eventName}</SheetTitle>
              <Badge variant="outline" className={cn("shrink-0", RESERVATION_STATUS_COLORS[r.status])}>
                {RESERVATION_STATUS_LABELS[r.status]}
              </Badge>
              {r.type === "MANTENIMIENTO" && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-zinc-300 bg-zinc-100 text-zinc-700"
                >
                  <Wrench data-icon="inline-start" />
                  Mantenimiento
                </Badge>
              )}
            </div>
            <SheetDescription>Detalle de la reserva de salón</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <Separator />

            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit();
                }}
                className="space-y-3"
              >
                <div className="space-y-1.5">
                  <Label>Salón</Label>
                  <Select value={editSpaceId} onValueChange={setEditSpaceId} disabled={isPending}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {spaces.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-date">Fecha</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-start">Hora inicio</Label>
                    <Input
                      id="edit-start"
                      type="time"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-end">Hora fin</Label>
                    <Input
                      id="edit-end"
                      type="time"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-notes">Notas</Label>
                  <Textarea
                    id="edit-notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    maxLength={500}
                    disabled={isPending}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditing(false)}
                    disabled={isPending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isPending}>
                    {isPending ? "Guardando…" : "Guardar cambios"}
                  </Button>
                </div>
              </form>
            ) : (
              <>
            {/* Datos principales */}
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Salón</p>
                  <p className="flex items-center gap-1.5 font-medium">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: space?.color ?? "#0ea5e9" }}
                    />
                    {space?.name ?? "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fecha</p>
                  <p className="font-medium capitalize">{dateLabel}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Horario</p>
                  <p className="font-medium">
                    {r.startTime
                      ? `${r.startTime}${r.endTime ? ` — ${r.endTime}` : ""}`
                      : "Sin franja definida"}
                  </p>
                </div>
              </div>

              {r.type === "EVENTO" ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Cliente
                      </p>
                      <p className="font-medium">{r.clientName ?? "—"}</p>
                    </div>
                  </div>

                  {r.opportunityId && (
                    <div className="flex items-start gap-2.5">
                      <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Oportunidad
                        </p>
                        <Link
                          href={`/pipeline/${r.opportunityId}`}
                          className="block truncate font-medium text-sky-950 underline-offset-2 hover:underline dark:text-sky-300"
                          title={`${r.opportunityCode} — ${r.opportunityTitle}`}
                        >
                          {r.opportunityCode} — {r.opportunityTitle}
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2.5">
                  <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo</p>
                    <p className="font-medium">Bloqueo de mantenimiento del salón</p>
                  </div>
                </div>
              )}

              {r.notes && (
                <div className="flex items-start gap-2.5">
                  <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notas</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{r.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {r.status === "TENTATIVA" && (
              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => setPendingStatus("CONFIRMADA")}
                disabled={isPending}
              >
                <CalendarCheck data-icon="inline-start" />
                Confirmar reserva
              </Button>
            )}

            {/* Cambio de estado */}
            <div className="space-y-1.5">
              <Label>Cambiar estado</Label>
              <Select
                value={r.status}
                onValueChange={(v) => {
                  if (v !== r.status) setPendingStatus(v as ReservationStatus);
                }}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESERVATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {RESERVATION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Tentativa → Confirmada → Cancelada. Se pedirá confirmación antes de aplicar.
              </p>
            </div>

            <Separator />

            {r.type === "EVENTO" && r.opportunityId && (
              <Button asChild variant="outline" className="w-full bg-sky-950 text-white hover:bg-sky-900">
                <Link href={`/cotizaciones/nueva?oportunidad=${r.opportunityId}`}>
                  <FileText data-icon="inline-start" />
                  Crear cotización para este evento
                </Link>
              </Button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={startEdit} disabled={isPending}>
                <Pencil data-icon="inline-start" />
                Editar
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={isPending}
              >
                <Trash2 data-icon="inline-start" />
                Eliminar
              </Button>
            </div>

            <Separator />

            {/* Log de actividad */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <History className="size-4 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Log de actividad
                </p>
                {logs.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    · {logs.length} {logs.length === 1 ? "evento" : "eventos"}
                  </span>
                )}
              </div>
              {logLoading ? (
                <p className="text-[11px] text-muted-foreground">Cargando…</p>
              ) : logs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Sin movimientos registrados.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-border pl-4">
                  {logs.map((l) => (
                    <li key={l.id} className="relative">
                      <span
                        className="absolute -left-[21px] mt-0.5 size-2.5 rounded-full ring-2 ring-background"
                        style={{ backgroundColor: LOG_ACTION_DOT[l.action] ?? "#64748b" }}
                      />
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", LOG_ACTION_BADGE[l.action])}
                      >
                        {LOG_ACTION_LABELS[l.action] ?? l.action}
                      </Badge>
                      {l.detail && <p className="mt-0.5 text-xs leading-snug">{l.detail}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {l.userName ?? "Sistema"} ·{" "}
                        {format(parseISO(l.createdAt), "dd/MM/yyyy, HH:mm", { locale: es })}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmación de cambio de estado */}
      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(o) => {
          if (!o) setPendingStatus(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "CANCELADA"
                ? "¿Cancelar esta reserva?"
                : `¿Cambiar estado a ${pendingStatus ? RESERVATION_STATUS_LABELS[pendingStatus] : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "CANCELADA"
                ? `La reserva de “${r.eventName}” en ${space?.name ?? "el salón"} dejará de mostrarse en el calendario y el día quedará disponible.`
                : pendingStatus === "CONFIRMADA"
                  ? `La reserva de “${r.eventName}” bloqueará ${space?.name ?? "el salón"} ese día. Se verificará que no exista otra reserva confirmada.`
                  : `La reserva de “${r.eventName}” volverá al estado tentativo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusChange}
              disabled={isPending}
              className={cn(
                pendingStatus === "CANCELADA" && "bg-destructive text-white hover:bg-destructive/90"
              )}
            >
              {isPending ? "Aplicando…" : "Sí, aplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de eliminación */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará de forma permanente la reserva de “{r.eventName}” en{" "}
              {space?.name ?? "el salón"} el {dateLabel}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
