"use client";

import { useDroppable } from "@dnd-kit/core";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/money";
import { STAGE_LABELS, type Stage } from "@/lib/constants";
import { STAGE_DOT } from "./pipeline-meta";
import { DraggableOpportunityCard } from "./opportunity-card";
import type { PipelineOpportunity } from "../types";

export function KanbanColumn({
  stage,
  opportunities,
  onOpen,
}: {
  stage: Stage;
  opportunities: PipelineOpportunity[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = opportunities.reduce((sum, o) => sum + o.estimatedValue, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
        isOver && "border-sky-950/40 bg-sky-50/60 ring-2 ring-sky-950/15"
      )}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", STAGE_DOT[stage])} />
          <span className="text-[13px] font-semibold">{STAGE_LABELS[stage]}</span>
          <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground ring-1 ring-border">
            {opportunities.length}
          </span>
        </div>
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {fmtUsd(total)}
        </span>
      </div>

      {/* Tarjetas */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {opportunities.map((opp) => (
          <DraggableOpportunityCard key={opp.id} opp={opp} onOpen={onOpen} />
        ))}
        {opportunities.length === 0 && (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-8 text-center",
              isOver ? "border-sky-950/40 bg-sky-100/40" : "border-border/70"
            )}
          >
            <Inbox className="size-4 text-muted-foreground/60" />
            <p className="text-[11px] text-muted-foreground">
              {isOver ? "Suelta aquí" : "Sin oportunidades"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
