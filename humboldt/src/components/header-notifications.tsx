"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlarmClock, Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TASK_TYPE_ICONS } from "@/app/(app)/pipeline/components/task-meta";
import { completeTask } from "@/app/(app)/pipeline/task-actions";

export interface HeaderTask {
  id: string;
  title: string;
  type: string;
  dueAt: string | Date;
  opportunityId: string;
  clientName: string;
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function HeaderNotifications({ tasks }: { tasks: HeaderTask[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toasted = useRef(false);

  const count = tasks.length;
  const start = startOfTodayMs();
  const vencidas = tasks.filter((t) => new Date(t.dueAt).getTime() < start);
  const hoy = tasks.filter((t) => new Date(t.dueAt).getTime() >= start);

  // Aviso (toast) una vez por sesión al entrar, si hay tareas.
  useEffect(() => {
    if (toasted.current || count === 0) return;
    toasted.current = true;
    if (typeof window !== "undefined" && window.sessionStorage.getItem("tasksToasted") === "1") return;
    toast(`Tenés ${count} tarea${count === 1 ? "" : "s"} pendiente${count === 1 ? "" : "s"}`, {
      description: vencidas.length
        ? `${vencidas.length} vencida${vencidas.length === 1 ? "" : "s"} · revisalas en la campana 🔔`
        : "Para hoy · revisalas en la campana 🔔",
    });
    if (typeof window !== "undefined") window.sessionStorage.setItem("tasksToasted", "1");
  }, [count, vencidas.length]);

  function handleComplete(id: string) {
    startTransition(async () => {
      const res = await completeTask({ id });
      if (res.ok) {
        toast.success("Tarea completada.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function renderItem(t: HeaderTask, overdue: boolean) {
    const Icon = TASK_TYPE_ICONS[t.type] ?? TASK_TYPE_ICONS.OTRO!;
    return (
      <div key={t.id} className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50">
        <button
          type="button"
          onClick={() => handleComplete(t.id)}
          disabled={pending}
          aria-label="Completar tarea"
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-transparent transition-colors hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-600"
        >
          <Check className="size-3" />
        </button>
        <Link
          href={`/pipeline?op=${t.opportunityId}&task=${t.id}`}
          onClick={() => setOpen(false)}
          className="min-w-0 flex-1"
        >
          <div className="flex items-center gap-1.5">
            <Icon className="size-3 shrink-0 text-muted-foreground" />
            <p className="truncate text-xs font-medium">{t.title}</p>
          </div>
          <p
            className={cn(
              "truncate text-[10px]",
              overdue ? "font-semibold text-rose-600" : "text-muted-foreground"
            )}
          >
            {overdue && <AlarmClock className="mr-0.5 inline size-2.5" />}
            {t.clientName} · {format(new Date(t.dueAt), "EEE d MMM, HH:mm", { locale: es })}
          </p>
        </Link>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notificaciones de tareas">
          <Bell />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-xs font-semibold">Tareas pendientes</p>
          <p className="text-[11px] text-muted-foreground">Vencidas y de hoy</p>
        </div>
        {count === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            Sin tareas pendientes 🎉
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {vencidas.length > 0 && (
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                Vencidas ({vencidas.length})
              </p>
            )}
            {vencidas.map((t) => renderItem(t, true))}
            {hoy.length > 0 && (
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Hoy ({hoy.length})
              </p>
            )}
            {hoy.map((t) => renderItem(t, false))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
