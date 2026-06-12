"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/money";
import { STAGES, STAGE_COLORS, STAGE_LABELS, type Stage } from "@/lib/constants";
import { initials, type PipelineOpportunity } from "../types";

type SortKey =
  | "code"
  | "title"
  | "client"
  | "stage"
  | "eventType"
  | "date"
  | "pax"
  | "value"
  | "prob"
  | "owner";

type SortDir = "asc" | "desc";

function sortValue(opp: PipelineOpportunity, key: SortKey): string | number {
  switch (key) {
    case "code":
      return opp.code;
    case "title":
      return opp.title.toLowerCase();
    case "client":
      return (opp.client.brandName ?? opp.client.legalName).toLowerCase();
    case "stage":
      return STAGES.indexOf(opp.stage as Stage);
    case "eventType":
      return (opp.eventType ?? "").toLowerCase();
    case "date":
      return opp.expectedEventDate ? opp.expectedEventDate.getTime() : Number.MAX_SAFE_INTEGER;
    case "pax":
      return opp.pax ?? -1;
    case "value":
      return opp.estimatedValue;
    case "prob":
      return opp.probability;
    case "owner":
      return opp.owner.name.toLowerCase();
  }
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}

export function PipelineTable({
  opportunities,
  onOpen,
}: {
  opportunities: PipelineOpportunity[];
  onOpen: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [dir, setDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const list = [...opportunities];
    list.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "es");
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [opportunities, sortKey, dir]);

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <SortHeader label="Código" sortKey="code" current={sortKey} dir={dir} onSort={handleSort} />
            <SortHeader label="Oportunidad" sortKey="title" current={sortKey} dir={dir} onSort={handleSort} />
            <SortHeader label="Cliente" sortKey="client" current={sortKey} dir={dir} onSort={handleSort} />
            <SortHeader label="Etapa" sortKey="stage" current={sortKey} dir={dir} onSort={handleSort} />
            <SortHeader label="Tipo de evento" sortKey="eventType" current={sortKey} dir={dir} onSort={handleSort} />
            <SortHeader label="Fecha evento" sortKey="date" current={sortKey} dir={dir} onSort={handleSort} />
            <SortHeader label="Pax" sortKey="pax" current={sortKey} dir={dir} onSort={handleSort} className="text-right" />
            <SortHeader label="Valor (USD)" sortKey="value" current={sortKey} dir={dir} onSort={handleSort} className="text-right" />
            <SortHeader label="Prob." sortKey="prob" current={sortKey} dir={dir} onSort={handleSort} className="text-right" />
            <SortHeader label="Responsable" sortKey="owner" current={sortKey} dir={dir} onSort={handleSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((opp) => {
            const stage = opp.stage as Stage;
            return (
              <TableRow
                key={opp.id}
                className="cursor-pointer"
                onClick={() => onOpen(opp.id)}
              >
                <TableCell className="font-mono text-[11px] text-muted-foreground">
                  {opp.code}
                </TableCell>
                <TableCell className="max-w-56">
                  <span className="block truncate text-xs font-medium">{opp.title}</span>
                </TableCell>
                <TableCell className="max-w-44">
                  <span className="block truncate text-xs text-muted-foreground">
                    {opp.client.brandName ?? opp.client.legalName}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("border", STAGE_COLORS[stage])}>
                    {STAGE_LABELS[stage] ?? opp.stage}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {opp.eventType ?? "—"}
                </TableCell>
                <TableCell className="text-xs tabular-nums text-muted-foreground">
                  {opp.expectedEventDate
                    ? format(opp.expectedEventDate, "d MMM yyyy", { locale: es })
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {opp.pax ?? "—"}
                </TableCell>
                <TableCell className="text-right text-xs font-semibold tabular-nums">
                  {fmtUsd(opp.estimatedValue)}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                  {opp.probability}%
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="size-5 border">
                      <AvatarFallback className="bg-sky-950 text-[8px] font-semibold text-white">
                        {initials(opp.owner.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs">{opp.owner.name}</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
