"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatDayEs } from "@/lib/dates";
import { CalendarDays, UsersRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/money";
import { initials, type PipelineOpportunity } from "../types";

/** Tarjeta presentacional (también se usa en el DragOverlay). */
export function OpportunityCard({
  opp,
  dragging,
}: {
  opp: PipelineOpportunity;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/card space-y-2 rounded-lg border bg-background p-3 text-left shadow-xs transition-shadow hover:shadow-md",
        dragging && "rotate-2 shadow-lg ring-2 ring-sky-950/20"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug">
          {opp.title}
        </p>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {opp.code.replace(/^OP-/, "")}
        </span>
      </div>

      <p className="truncate text-xs text-muted-foreground">
        {opp.client.brandName ?? opp.client.legalName}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {opp.eventType && (
          <Badge variant="outline" className="max-w-36 truncate">
            {opp.eventType}
          </Badge>
        )}
        {opp.pax != null && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <UsersRound className="size-3" />
            {opp.pax}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 pt-0.5">
        <div>
          <p className="text-sm font-bold tabular-nums">{fmtUsd(opp.estimatedValue)}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-sky-950"
                style={{ width: `${Math.min(100, Math.max(0, opp.probability))}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {opp.probability}%
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {opp.expectedEventDate && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <CalendarDays className="size-3" />
              {formatDayEs(opp.expectedEventDate, "d MMM yy")}
            </span>
          )}
          <Avatar className="size-5 border" title={opp.owner.name}>
            <AvatarFallback className="bg-sky-950 text-[8px] font-semibold text-white">
              {initials(opp.owner.name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
}

/** Envoltorio arrastrable + clic para abrir el detalle. */
export function DraggableOpportunityCard({
  opp,
  onOpen,
}: {
  opp: PipelineOpportunity;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opp.id,
    data: { stage: opp.stage },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-grab touch-none outline-none active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
      onClick={() => onOpen(opp.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(opp.id);
      }}
      aria-label={`Abrir oportunidad ${opp.title}`}
      {...attributes}
      {...listeners}
    >
      <OpportunityCard opp={opp} />
    </div>
  );
}
