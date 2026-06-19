"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  KanbanSquare,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  STAGES,
  STAGE_DEFAULT_PROBABILITY,
  type Stage,
} from "@/lib/constants";
import { moveOpportunityStage } from "../actions";
import type { BasicClient, BasicUser, PipelineOpportunity } from "../types";
import { KanbanColumn } from "./kanban-column";
import { OpportunityCard } from "./opportunity-card";
import { OpportunitySheet } from "./opportunity-sheet";
import { NewOpportunityDialog } from "./new-opportunity-dialog";
import { LostReasonDialog } from "./lost-reason-dialog";
import { PipelineTable } from "./pipeline-table";

interface LostPending {
  oppId: string;
  fromStage: Stage;
  fromProbability: number;
  fromLostReason: string | null;
  title: string;
}

export function PipelineBoard({
  opportunities,
  users,
  eventTypes,
  channels,
  clients,
  currentUserId,
  initialSelectedId = null,
  initialTaskId = null,
}: {
  opportunities: PipelineOpportunity[];
  users: BasicUser[];
  eventTypes: string[];
  channels: string[];
  clients: BasicClient[];
  currentUserId: string;
  initialSelectedId?: string | null;
  initialTaskId?: string | null;
}) {
  // Estado local sincronizado con el servidor (optimistic UI)
  const [opps, setOpps] = useState(opportunities);
  useEffect(() => setOpps(opportunities), [opportunities]);

  // Filtros y vista
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [view, setView] = useState<"kanban" | "lista">("kanban");

  // Detalle / diálogos (initialSelectedId permite deep-links /pipeline?op=ID)
  const router = useRouter();
  const pathname = usePathname();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  // Abre el detalle cuando cambia el deep-link ?op= (ej. al pulsar una notificación
  // estando ya en /pipeline). useState solo toma el valor inicial al montar.
  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);
  // Tarea a resaltar (deep-link ?task=ID desde una notificación).
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(initialTaskId);
  useEffect(() => {
    setHighlightTaskId(initialTaskId);
  }, [initialTaskId]);
  const [newOpen, setNewOpen] = useState(false);
  const [lostPending, setLostPending] = useState<LostPending | null>(null);

  // Drag & drop
  const [activeId, setActiveId] = useState<string | null>(null);
  const recentDragRef = useRef(false);
  const [, startTransition] = useTransition();
  const [stagePending, setStagePending] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const sellers = useMemo(
    () => users.filter((u) => u.role === "EJECUTIVO" || u.role === "GERENTE"),
    [users]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opps.filter((o) => {
      if (ownerFilter !== "ALL" && o.ownerId !== ownerFilter) return false;
      if (typeFilter !== "ALL" && o.eventType !== typeFilter) return false;
      if (q) {
        const haystack = [
          o.title,
          o.code,
          o.client.legalName,
          o.client.brandName ?? "",
          o.eventType ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [opps, query, ownerFilter, typeFilter]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, PipelineOpportunity[]>();
    for (const s of STAGES) map.set(s, []);
    for (const o of filtered) {
      const list = map.get(o.stage as Stage);
      if (list) list.push(o);
      else map.get("NUEVO")!.push(o); // etapa desconocida: cae en Nuevo
    }
    return map;
  }, [filtered]);

  const activeOpp = activeId ? opps.find((o) => o.id === activeId) ?? null : null;
  const selectedOpp = selectedId ? opps.find((o) => o.id === selectedId) ?? null : null;

  const hasFilters = query.trim() !== "" || ownerFilter !== "ALL" || typeFilter !== "ALL";

  // ── Mutaciones ──────────────────────────────────────────────────────

  const patchOpp = (id: string, patch: Partial<PipelineOpportunity>) =>
    setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const applyStageLocal = (id: string, stage: Stage, lostReason: string | null) =>
    patchOpp(id, {
      stage,
      probability: STAGE_DEFAULT_PROBABILITY[stage],
      lostReason,
    });

  const persistStage = (
    opp: PipelineOpportunity,
    stage: Stage,
    lostReason: string | null,
    revert: () => void
  ) => {
    setStagePending(true);
    startTransition(async () => {
      const res = await moveOpportunityStage({ id: opp.id, stage, lostReason });
      setStagePending(false);
      if (!res.ok) {
        revert();
        toast.error(res.error);
      } else {
        toast.success(
          stage === "PERDIDO"
            ? "Oportunidad marcada como perdida"
            : stage === "GANADO"
              ? "¡Oportunidad ganada! 🎉"
              : "Etapa actualizada"
        );
      }
    });
  };

  const handleStageChange = (opp: PipelineOpportunity, stage: Stage) => {
    if (opp.stage === stage) return;
    const snapshot: LostPending = {
      oppId: opp.id,
      fromStage: opp.stage as Stage,
      fromProbability: opp.probability,
      fromLostReason: opp.lostReason,
      title: opp.title,
    };
    // Movimiento optimista inmediato
    applyStageLocal(opp.id, stage, stage === "PERDIDO" ? opp.lostReason : null);

    if (stage === "PERDIDO") {
      // Motivo obligatorio antes de confirmar
      setLostPending(snapshot);
      return;
    }
    persistStage(opp, stage, null, () =>
      patchOpp(opp.id, {
        stage: snapshot.fromStage,
        probability: snapshot.fromProbability,
        lostReason: snapshot.fromLostReason,
      })
    );
  };

  const revertLost = () => {
    if (!lostPending) return;
    patchOpp(lostPending.oppId, {
      stage: lostPending.fromStage,
      probability: lostPending.fromProbability,
      lostReason: lostPending.fromLostReason,
    });
    setLostPending(null);
  };

  const confirmLost = (reason: string) => {
    if (!lostPending) return;
    const snapshot = lostPending;
    const opp = opps.find((o) => o.id === snapshot.oppId);
    if (!opp) {
      setLostPending(null);
      return;
    }
    patchOpp(snapshot.oppId, { lostReason: reason });
    persistStage(opp, "PERDIDO", reason, () =>
      patchOpp(snapshot.oppId, {
        stage: snapshot.fromStage,
        probability: snapshot.fromProbability,
        lostReason: snapshot.fromLostReason,
      })
    );
    setLostPending(null);
  };

  // ── Drag & drop ─────────────────────────────────────────────────────

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    recentDragRef.current = true;
    setTimeout(() => (recentDragRef.current = false), 120);

    const { active, over } = event;
    if (!over) return;
    const targetStage = String(over.id) as Stage;
    if (!STAGES.includes(targetStage)) return;
    const opp = opps.find((o) => o.id === String(active.id));
    if (!opp) return;
    handleStageChange(opp, targetStage);
  };

  const openDetail = (id: string) => {
    if (recentDragRef.current) return; // evita abrir el sheet justo después de arrastrar
    setSelectedId(id);
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Barra de filtros y acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-64">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, cliente o código…"
            className="pl-8"
            aria-label="Buscar oportunidades"
          />
        </div>

        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-44" aria-label="Filtrar por ejecutivo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los ejecutivos</SelectItem>
            {sellers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" aria-label="Filtrar por tipo de evento">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {eventTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setOwnerFilter("ALL");
              setTypeFilter("ALL");
            }}
          >
            Limpiar filtros
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Toggle de vista */}
          <div className="flex items-center rounded-md border bg-background p-0.5">
            <Button
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("kanban")}
              aria-pressed={view === "kanban"}
            >
              <LayoutGrid />
              Kanban
            </Button>
            <Button
              variant={view === "lista" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("lista")}
              aria-pressed={view === "lista"}
            >
              <List />
              Lista
            </Button>
          </div>

          <Button
            className="bg-sky-950 hover:bg-sky-900"
            onClick={() => setNewOpen(true)}
          >
            <Plus />
            Nueva oportunidad
          </Button>
        </div>
      </div>

      {/* Contenido */}
      {opps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-sky-950/5">
            <KanbanSquare className="size-6 text-sky-950" />
          </div>
          <div>
            <p className="text-sm font-semibold">Sin oportunidades en el pipeline</p>
            <p className="text-xs text-muted-foreground">
              Crea la primera oportunidad para empezar a gestionar tus ventas.
            </p>
          </div>
          <Button className="bg-sky-950 hover:bg-sky-900" onClick={() => setNewOpen(true)}>
            <Plus />
            Nueva oportunidad
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <SlidersHorizontal className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Sin resultados</p>
            <p className="text-xs text-muted-foreground">
              Ninguna oportunidad coincide con los filtros aplicados.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setOwnerFilter("ALL");
              setTypeFilter("ALL");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : view === "kanban" ? (
        <DndContext
          id="pipeline-dnd"
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                opportunities={byStage.get(stage) ?? []}
                onOpen={openDetail}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeOpp ? (
              <div className="w-[264px]">
                <OpportunityCard opp={activeOpp} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <PipelineTable opportunities={filtered} onOpen={openDetail} />
      )}

      {/* Sheet de detalle */}
      <OpportunitySheet
        opp={selectedOpp}
        open={!!selectedOpp}
        onOpenChange={(o) => {
          if (o) return;
          setSelectedId(null);
          setHighlightTaskId(null);
          // Limpia ?op= de la URL para que re-pulsar la misma notificación reabra el detalle.
          if (
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has("op")
          ) {
            router.replace(pathname, { scroll: false });
          }
        }}
        onStageChange={handleStageChange}
        onPatch={patchOpp}
        highlightTaskId={highlightTaskId}
      />

      {/* Dialog motivo de pérdida (obligatorio) */}
      <LostReasonDialog
        open={!!lostPending}
        title={lostPending?.title ?? null}
        pending={stagePending}
        onConfirm={confirmLost}
        onCancel={revertLost}
      />

      {/* Dialog nueva oportunidad */}
      <NewOpportunityDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        clients={clients}
        users={users}
        eventTypes={eventTypes}
        channels={channels}
        currentUserId={currentUserId}
      />
    </div>
  );
}
