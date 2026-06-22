"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { formatDayEs } from "@/lib/dates";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  BedDouble,
  CableCar,
  CalendarDays,
  ExternalLink,
  FileText,
  Megaphone,
  Send,
  UsersRound,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/money";
import {
  STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
  type Stage,
} from "@/lib/constants";
import { addOpportunityNote, updateOpportunityDetails } from "../actions";
import { initials, type PipelineOpportunity } from "../types";
import { ACTIVITY_TYPE_ICONS, ACTIVITY_TYPE_LABELS } from "./pipeline-meta";
import { TaskSection } from "./task-section";
import { AttachmentsSection } from "./attachments-section";

function DataItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-medium">{value}</p>
      </div>
    </div>
  );
}

export function OpportunitySheet({
  opp,
  open,
  onOpenChange,
  onStageChange,
  onPatch,
  highlightTaskId,
}: {
  opp: PipelineOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageChange: (opp: PipelineOpportunity, stage: Stage) => void;
  onPatch: (id: string, patch: Partial<PipelineOpportunity>) => void;
  highlightTaskId?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [prob, setProb] = useState(opp?.probability ?? 0);
  const [obs, setObs] = useState(opp?.observations ?? "");
  const [note, setNote] = useState("");

  // Sincroniza cada campo por separado para no pisar ediciones en curso
  useEffect(() => {
    setProb(opp?.probability ?? 0);
  }, [opp?.id, opp?.probability]);

  useEffect(() => {
    setObs(opp?.observations ?? "");
  }, [opp?.id, opp?.observations]);

  useEffect(() => {
    setNote("");
  }, [opp?.id]);

  if (!opp) return null;

  const obsDirty = obs !== (opp.observations ?? "");

  const commitProbability = () => {
    if (prob === opp.probability) return;
    onPatch(opp.id, { probability: prob });
    startTransition(async () => {
      const res = await updateOpportunityDetails({ id: opp.id, probability: prob });
      if (!res.ok) {
        onPatch(opp.id, { probability: opp.probability });
        setProb(opp.probability);
        toast.error(res.error);
      } else {
        toast.success("Probabilidad actualizada");
      }
    });
  };

  const saveObservations = () => {
    startTransition(async () => {
      const res = await updateOpportunityDetails({ id: opp.id, observations: obs });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        onPatch(opp.id, { observations: obs === "" ? null : obs });
        toast.success("Observaciones guardadas");
      }
    });
  };

  const submitNote = () => {
    const body = note.trim();
    if (body.length < 2) {
      toast.error("Escribe una nota más larga");
      return;
    }
    startTransition(async () => {
      const res = await addOpportunityNote({ id: opp.id, body });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        setNote("");
        toast.success("Nota agregada");
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-[50vw]"
      >
        <SheetHeader className="border-b pb-4">
          <p className="font-mono text-[11px] text-muted-foreground">{opp.code}</p>
          <SheetTitle className="pr-8 text-base leading-snug">{opp.title}</SheetTitle>
          <SheetDescription asChild>
            <span className="flex items-center gap-1.5">
              <Link
                href={`/clientes/${opp.client.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-900 hover:underline"
              >
                {opp.client.brandName ?? opp.client.legalName}
                <ExternalLink className="size-3" />
              </Link>
              {opp.client.brandName && (
                <span className="truncate text-[11px] text-muted-foreground">
                  · {opp.client.legalName}
                </span>
              )}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-6 pt-4">
          {/* Etapas como pills */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Etapa
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => {
                const active = opp.stage === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={pending}
                    onClick={() => !active && onStageChange(opp, s)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                      active
                        ? cn(STAGE_COLORS[s], "ring-2 ring-sky-950/15")
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {STAGE_LABELS[s]}
                  </button>
                );
              })}
            </div>
            {opp.stage === "PERDIDO" && opp.lostReason && (
              <p className="mt-2 text-[11px] text-rose-700">
                Motivo de pérdida: <span className="font-medium">{opp.lostReason}</span>
              </p>
            )}
          </div>

          {/* Valor + probabilidad */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Valor estimado
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums">
              {fmtUsd(opp.estimatedValue)}
            </p>
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Probabilidad de cierre
                </p>
                <span className="text-xs font-bold tabular-nums">{prob}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={prob}
                disabled={pending}
                onChange={(e) => setProb(Number(e.target.value))}
                onPointerUp={commitProbability}
                onKeyUp={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") commitProbability();
                }}
                className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-sky-950"
                aria-label="Probabilidad de cierre"
              />
            </div>
          </div>

          {/* Datos del evento */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Datos del evento
            </p>
            <div className="grid grid-cols-2 gap-2">
              <DataItem
                icon={CalendarDays}
                label="Fecha esperada"
                value={
                  opp.expectedEventDate
                    ? formatDayEs(opp.expectedEventDate, "d 'de' MMMM yyyy")
                    : "Por definir"
                }
              />
              <DataItem
                icon={UsersRound}
                label="Pax"
                value={opp.pax != null ? opp.pax : "Por definir"}
              />
              <DataItem icon={BedDouble} label="Habitaciones" value={opp.roomsCount} />
              <DataItem icon={CableCar} label="VG teleférico" value={opp.vgCount} />
            </div>
          </div>

          {/* Responsable y canal */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
              <Avatar className="size-7 border">
                <AvatarFallback className="bg-sky-950 text-[10px] font-semibold text-white">
                  {initials(opp.owner.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Responsable
                </p>
                <p className="truncate text-xs font-medium">{opp.owner.name}</p>
              </div>
            </div>
            <DataItem icon={Megaphone} label="Canal" value={opp.channel ?? "—"} />
          </div>

          {/* Contacto */}
          {opp.contact && (
            <div className="rounded-lg border bg-muted/30 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contacto</p>
              <p className="text-xs font-medium">{opp.contact.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {[opp.contact.phone, opp.contact.email].filter(Boolean).join(" · ") || "Sin datos"}
              </p>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Observaciones
            </p>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Notas internas de la oportunidad…"
              className="min-h-20 text-xs"
            />
            {obsDirty && (
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setObs(opp.observations ?? "")}
                >
                  Descartar
                </Button>
                <Button size="sm" disabled={pending} onClick={saveObservations}>
                  {pending ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            )}
          </div>

          {/* Cotizaciones */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cotizaciones
            </p>
            {opp.quotes.length > 0 ? (
              <div className="space-y-1.5">
                {opp.quotes.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono text-[11px]">{q.number}</span>
                      <Badge
                        variant="outline"
                        className={cn("border", QUOTE_STATUS_COLORS[q.status as QuoteStatus])}
                      >
                        {QUOTE_STATUS_LABELS[q.status as QuoteStatus] ?? q.status}
                      </Badge>
                    </div>
                    <span className="text-xs font-semibold tabular-nums">
                      {fmtUsd(q.totalUsd)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
                Esta oportunidad aún no tiene cotizaciones.
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Button asChild size="sm" className="bg-sky-950 hover:bg-sky-900">
                <Link href={`/cotizaciones/nueva?oportunidad=${opp.id}`}>
                  <FileText />
                  Crear cotización
                </Link>
              </Button>
              {opp.quotes.length > 0 && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/cotizaciones?oportunidad=${opp.id}`}>
                    Ver cotizaciones ({opp.quotes.length})
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Documentos del evento (expediente) */}
          <AttachmentsSection opportunityId={opp.id} />

          <Separator />

          {/* Tareas programadas */}
          <TaskSection opportunityId={opp.id} tasks={opp.tasks} highlightId={highlightTaskId} />

          <Separator />

          {/* Timeline de actividad */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Actividad
            </p>

            {/* Nota rápida */}
            <div className="mb-3 flex gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitNote();
                  }
                }}
                placeholder="Agregar una nota rápida…"
                className="text-xs"
                disabled={pending}
              />
              <Button
                size="icon"
                variant="outline"
                disabled={pending || note.trim().length < 2}
                onClick={submitNote}
                aria-label="Agregar nota"
              >
                <Send />
              </Button>
            </div>

            {opp.activities.length > 0 ? (
              <ol className="relative space-y-4 border-l border-border pl-4">
                {opp.activities.map((act) => {
                  const Icon = ACTIVITY_TYPE_ICONS[act.type] ?? ACTIVITY_TYPE_ICONS.SISTEMA!;
                  return (
                    <li key={act.id} className="relative">
                      <span className="absolute -left-[23px] flex size-3.5 items-center justify-center rounded-full bg-background ring-1 ring-border">
                        <Icon className="size-2 text-muted-foreground" />
                      </span>
                      <div className="space-y-0.5">
                        <p className="text-xs leading-snug">{act.body}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {ACTIVITY_TYPE_LABELS[act.type] ?? act.type} · {act.user.name} ·{" "}
                          {formatDistanceToNow(act.createdAt, { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
                Sin actividad registrada todavía.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
