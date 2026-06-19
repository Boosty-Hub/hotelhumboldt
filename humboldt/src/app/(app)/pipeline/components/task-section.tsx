"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlarmClock,
  CalendarDays,
  Check,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  RECURRENCES,
  RECURRENCE_LABELS,
  type TaskType,
  type Recurrence,
} from "@/lib/constants";
import { TASK_TYPE_ICONS } from "./task-meta";
import { createTask, completeTask, snoozeTask, cancelTask } from "../task-actions";
import type { PipelineTask } from "../types";

type LocalTask = {
  id: string;
  type: string;
  title: string;
  dueAt: string | Date;
  status: string;
  recurrence: string;
};

function toLocal(t: PipelineTask): LocalTask {
  return { id: t.id, type: t.type, title: t.title, dueAt: t.dueAt, status: t.status, recurrence: t.recurrence };
}

/** Combina un día (Calendar) + hora "HH:mm" en un ISO string. */
function toIso(day: Date, time: string): string {
  const [hh, mm] = (time || "09:00").split(":").map((n) => parseInt(n, 10));
  const d = new Date(day);
  d.setHours(Number.isNaN(hh) ? 9 : hh, Number.isNaN(mm) ? 0 : mm, 0, 0);
  return d.toISOString();
}

export function TaskSection({
  opportunityId,
  tasks: initialTasks,
  highlightId,
}: {
  opportunityId: string;
  tasks: PipelineTask[];
  highlightId?: string | null;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<LocalTask[]>(() => initialTasks.map(toLocal));
  const [pending, startTransition] = useTransition();

  // Composer
  const [type, setType] = useState<TaskType>("VOLVER_CONTACTAR");
  const [title, setTitle] = useState("");
  const [day, setDay] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");
  const [recurrence, setRecurrence] = useState<Recurrence>("NONE");
  const [highlighted, setHighlighted] = useState<string | null>(null);

  // Scroll + resaltado a la tarea de la notificación (deep-link ?task=ID).
  useEffect(() => {
    if (!highlightId) return;
    setHighlighted(highlightId);
    const scrollTimer = setTimeout(() => {
      document
        .getElementById(`task-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    const clearTimer = setTimeout(() => setHighlighted(null), 4000);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightId]);

  // Re-sembrar al cambiar de oportunidad
  useEffect(() => {
    setTasks(initialTasks.map(toLocal));
    setType("VOLVER_CONTACTAR");
    setTitle("");
    setDay(undefined);
    setTime("09:00");
    setRecurrence("NONE");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  const pendientes = tasks
    .filter((t) => t.status === "PENDIENTE")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const completadas = tasks.filter((t) => t.status === "COMPLETADA").slice(0, 5);

  function handleCreate() {
    if (!day) {
      toast.error("Elegí una fecha para la tarea.");
      return;
    }
    const effectiveTitle = title.trim() || TASK_TYPE_LABELS[type];
    const dueIso = toIso(day, time);
    startTransition(async () => {
      const res = await createTask({
        opportunityId,
        type,
        title: effectiveTitle,
        dueAt: dueIso,
        recurrence,
      });
      if (res.ok) {
        setTasks((prev) => [
          { id: res.id ?? `tmp-${prev.length}`, type, title: effectiveTitle, dueAt: dueIso, status: "PENDIENTE", recurrence },
          ...prev,
        ]);
        setTitle("");
        setDay(undefined);
        setTime("09:00");
        setRecurrence("NONE");
        setType("VOLVER_CONTACTAR");
        toast.success("Tarea programada.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleComplete(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "COMPLETADA" } : t)));
    startTransition(async () => {
      const res = await completeTask({ id });
      if (res.ok) {
        toast.success("Tarea completada.");
        router.refresh();
      } else {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "PENDIENTE" } : t)));
        toast.error(res.error);
      }
    });
  }

  function handleSnooze(id: string, days: number) {
    const next = new Date();
    next.setDate(next.getDate() + days);
    next.setHours(9, 0, 0, 0);
    const iso = next.toISOString();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, dueAt: iso } : t)));
    startTransition(async () => {
      const res = await snoozeTask({ id, dueAt: iso });
      if (res.ok) {
        toast.success(days === 1 ? "Pospuesta 1 día." : `Pospuesta ${days} días.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleCancel(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      const res = await cancelTask({ id });
      if (res.ok) {
        toast.success("Tarea cancelada.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Tareas
      </p>

      {/* Composer */}
      <div className="mb-3 space-y-2 rounded-xl border bg-muted/30 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TASK_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRENCES.map((r) => (
                <SelectItem key={r} value={r}>
                  {RECURRENCE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Título (por defecto: ${TASK_TYPE_LABELS[type]})`}
          className="text-xs"
          disabled={pending}
        />

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start font-normal">
                <CalendarDays data-icon="inline-start" />
                {day ? format(day, "d MMM yyyy", { locale: es }) : "Fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={day} onSelect={setDay} locale={es} autoFocus />
            </PopoverContent>
          </Popover>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-24 text-xs tabular-nums"
            disabled={pending}
            aria-label="Hora"
          />
        </div>

        <Button onClick={handleCreate} disabled={pending} className="w-full bg-sky-950 hover:bg-sky-900">
          <Plus data-icon="inline-start" />
          Agregar tarea
        </Button>
      </div>

      {/* Lista pendientes */}
      {pendientes.length > 0 ? (
        <ul className="space-y-1.5">
          {pendientes.map((t) => {
            const Icon = TASK_TYPE_ICONS[t.type] ?? TASK_TYPE_ICONS.OTRO!;
            const due = new Date(t.dueAt);
            const overdue = due.getTime() < Date.now();
            return (
              <li
                key={t.id}
                id={`task-${t.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 transition-all",
                  highlighted === t.id && "bg-sky-50 ring-2 ring-sky-400"
                )}
              >
                <button
                  type="button"
                  onClick={() => handleComplete(t.id)}
                  disabled={pending}
                  aria-label="Completar tarea"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-transparent transition-colors hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-600"
                >
                  <Check className="size-3" />
                </button>
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{t.title}</p>
                  <p className={cn("text-[10px]", overdue ? "font-semibold text-rose-600" : "text-muted-foreground")}>
                    {overdue && <AlarmClock className="mr-0.5 inline size-2.5" />}
                    {format(due, "EEE d MMM, HH:mm", { locale: es })}
                    {t.recurrence !== "NONE" && ` · ${RECURRENCE_LABELS[t.recurrence as Recurrence]}`}
                  </p>
                </div>
                {t.recurrence !== "NONE" && (
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                    ↻
                  </Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" disabled={pending} aria-label="Más">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSnooze(t.id, 1)}>
                      <AlarmClock />
                      Posponer 1 día
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSnooze(t.id, 7)}>
                      <AlarmClock />
                      Posponer 1 semana
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => handleCancel(t.id)}>
                      <X />
                      Cancelar tarea
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
          Sin tareas pendientes. Programá la próxima acción arriba.
        </p>
      )}

      {/* Completadas recientes */}
      {completadas.length > 0 && (
        <div className="mt-2">
          {completadas.map((t) => (
            <p key={t.id} className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-muted-foreground">
              <Check className="size-2.5 text-emerald-600" />
              <span className="truncate line-through">{t.title}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
