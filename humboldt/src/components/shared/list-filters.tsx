"use client";

// Toolbar de filtros reutilizable y server-side (sincroniza con la URL).
// Cada vista enciende solo los controles que necesita: búsqueda, estado,
// rango de fechas (desde–hasta + atajos de período) y orden asc/desc.
// Lo usan Cotizaciones, BEO, Clientes y Contactos para compartir la MISMA visual.

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";
import { ArrowDownUp, CalendarRange, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortDir } from "@/lib/list-query";

const ALL = "TODOS";
type PresetKey = "mes" | "trimestre" | "anio";

export interface FilterOption {
  value: string;
  label: string;
}

interface DateRangeConfig {
  /** Texto de ayuda del rango (ej. "Fecha del evento"). */
  label?: string;
}

interface DirectionConfig {
  ascLabel?: string;
  descLabel?: string;
  defaultDir?: SortDir;
}

export interface ListFiltersProps {
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  /** Param de la URL para el estado (default "estado"). */
  statusParam?: string;
  statusOptions?: FilterOption[];
  statusAllLabel?: string;
  statusAriaLabel?: string;
  /** Activa el rango desde–hasta + atajos de período. */
  dateRange?: DateRangeConfig | boolean;
  /** Activa el toggle de orden ascendente/descendente (param "dir"). */
  direction?: DirectionConfig | boolean;
  /**
   * Params propios de la vista (inyectados como children) que "Limpiar" debe
   * borrar y que cuentan para mostrar el botón Limpiar. Ej: ["orden", "inactivos"].
   */
  extraParams?: string[];
  /** Controles extra propios de la vista (ej. switch "mostrar inactivos"). */
  children?: React.ReactNode;
}

/** Calcula el rango (yyyy-MM-dd) de un atajo de período, relativo a hoy. */
function presetRange(key: PresetKey): { desde: string; hasta: string } {
  const now = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  if (key === "mes") return { desde: fmt(startOfMonth(now)), hasta: fmt(endOfMonth(now)) };
  if (key === "trimestre")
    return { desde: fmt(startOfQuarter(now)), hasta: fmt(endOfQuarter(now)) };
  return { desde: fmt(startOfYear(now)), hasta: fmt(endOfYear(now)) };
}

const PRESET_LABELS: Record<PresetKey, string> = {
  mes: "Este mes",
  trimestre: "Este trimestre",
  anio: "Este año",
};

export function ListFilters({
  searchPlaceholder = "Buscar…",
  searchAriaLabel = "Buscar",
  statusParam = "estado",
  statusOptions,
  statusAllLabel = "Todos los estados",
  statusAriaLabel = "Filtrar por estado",
  dateRange,
  direction,
  extraParams,
  children,
}: ListFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const firstRender = useRef(true);

  const dirConfig: DirectionConfig = typeof direction === "object" ? direction : {};
  const defaultDir: SortDir = dirConfig.defaultDir ?? "desc";
  const rangeConfig: DateRangeConfig = typeof dateRange === "object" ? dateRange : {};

  // Búsqueda: estado local para el debounce, reconciliado con la URL durante el
  // render (patrón oficial de React, NO useEffect) para reflejar back/forward o
  // un reset externo de ?q sin desincronizarse.
  const urlQ = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(urlQ);
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    setSearch(urlQ);
  }

  // Empuja cambios de filtro a la URL. Lee la URL VIVA (window.location) en lugar
  // del snapshot del closure para evitar pisar cambios entre escritores distintos
  // (ej. en Clientes coexisten este toolbar y los controles de orden/inactivos).
  function apply(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // Búsqueda con debounce; solo navega si el término cambió respecto a la URL.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      const current = new URLSearchParams(window.location.search).get("q") ?? "";
      if (current !== search.trim()) apply({ q: search.trim() || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const desde = searchParams.get("desde") ?? "";
  const hasta = searchParams.get("hasta") ?? "";
  const dir = (searchParams.get("dir") as SortDir | null) ?? defaultDir;
  const hasFilters = Boolean(
    search ||
      searchParams.get(statusParam) ||
      desde ||
      hasta ||
      searchParams.get("dir") ||
      (extraParams ?? []).some((k) => searchParams.get(k))
  );

  function clearAll() {
    setSearch("");
    const updates: Record<string, string | null> = {
      q: null,
      [statusParam]: null,
      desde: null,
      hasta: null,
      dir: null,
    };
    for (const k of extraParams ?? []) updates[k] = null;
    apply(updates);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Búsqueda */}
      <div className="relative w-full max-w-xs">
        {pending ? (
          <Loader2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
          aria-label={searchAriaLabel}
        />
      </div>

      {/* Estado */}
      {statusOptions && statusOptions.length > 0 && (
        <Select
          value={searchParams.get(statusParam) ?? ALL}
          onValueChange={(v) => apply({ [statusParam]: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-44" aria-label={statusAriaLabel}>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{statusAllLabel}</SelectItem>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Rango de fechas + atajos de período */}
      {dateRange && (
        <>
          {/* value="" es deliberado: el Select actúa como menú de acción (rellena
              las fechas) y vuelve al placeholder tras cada elección. No tocar. */}
          <Select
            value=""
            onValueChange={(k) => {
              const r = presetRange(k as PresetKey);
              apply({ desde: r.desde, hasta: r.hasta });
            }}
          >
            <SelectTrigger className="w-40" aria-label="Atajo de período">
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESET_LABELS) as PresetKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {PRESET_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePicker
            value={desde}
            max={hasta || undefined}
            onChange={(v) => apply({ desde: v || null })}
            className="w-[150px]"
            clearable
            placeholder="Desde"
            aria-label={rangeConfig.label ? `${rangeConfig.label}: desde` : "Desde"}
          />
          <span className="text-sm text-muted-foreground">–</span>
          <DatePicker
            value={hasta}
            min={desde || undefined}
            onChange={(v) => apply({ hasta: v || null })}
            className="w-[150px]"
            clearable
            placeholder="Hasta"
            aria-label={rangeConfig.label ? `${rangeConfig.label}: hasta` : "Hasta"}
          />
        </>
      )}

      {/* Orden ascendente / descendente */}
      {direction && (
        <Button
          variant="outline"
          className="h-7"
          onClick={() => {
            const next: SortDir = dir === "asc" ? "desc" : "asc";
            apply({ dir: next === defaultDir ? null : next });
          }}
          aria-label="Cambiar orden"
        >
          <ArrowDownUp data-icon="inline-start" />
          {dir === "asc"
            ? dirConfig.ascLabel ?? "Ascendente"
            : dirConfig.descLabel ?? "Descendente"}
        </Button>
      )}

      {/* Controles extra propios de la vista */}
      {children}

      {/* Limpiar */}
      {hasFilters && (
        <Button variant="ghost" className="h-7" onClick={clearAll}>
          <X data-icon="inline-start" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
