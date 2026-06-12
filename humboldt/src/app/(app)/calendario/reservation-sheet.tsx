"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Clock,
  ExternalLink,
  StickyNote,
  Trash2,
  User,
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
  type ReservationStatus,
} from "@/lib/constants";
import { deleteReservation, updateReservationStatus } from "./actions";
import { RESERVATION_STATUS_COLORS, type CalendarSpaceDTO, type ReservationDTO } from "./types";

interface ReservationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: ReservationDTO | null;
  space: CalendarSpaceDTO | null;
}

export function ReservationSheet({
  open,
  onOpenChange,
  reservation,
  space,
}: ReservationSheetProps) {
  const [pendingStatus, setPendingStatus] = useState<ReservationStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!reservation) return null;
  const r = reservation;

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

  const dateLabel = format(parseISO(r.dateKey), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

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
            </div>
            <SheetDescription>Detalle de la reserva de salón</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <Separator />

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

              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cliente</p>
                  <p className="font-medium">{r.clientName}</p>
                </div>
              </div>

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

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
            >
              <Trash2 data-icon="inline-start" />
              Eliminar reserva
            </Button>
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
