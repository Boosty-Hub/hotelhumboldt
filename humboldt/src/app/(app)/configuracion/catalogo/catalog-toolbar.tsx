"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { PRODUCT_TYPES } from "@/lib/constants";
import { PRODUCT_TYPE_SHORT_LABELS, type CategoryOption } from "./catalog-shared";

const ALL = "__TODOS__";
const NO_CATEGORY = "SIN_CATEGORIA";

export interface CatalogFilters {
  q: string;
  categoria: string;
  tipo: string;
  inactivos: boolean;
}

export function CatalogToolbar({
  categories,
  filters,
}: {
  categories: CategoryOption[];
  filters: CatalogFilters;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);
  const firstRender = useRef(true);

  const navigate = (next: Partial<CatalogFilters>) => {
    const merged: CatalogFilters = { ...filters, q, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.categoria) params.set("categoria", merged.categoria);
    if (merged.tipo) params.set("tipo", merged.tipo);
    if (merged.inactivos) params.set("inactivos", "1");
    const qs = params.toString();
    router.replace(qs ? `/configuracion/catalogo?${qs}` : "/configuracion/catalogo");
  };

  // Búsqueda con debounce (server-side)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => navigate({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto…"
          className="pl-8"
          aria-label="Buscar producto"
        />
      </div>

      <Select
        value={filters.categoria || ALL}
        onValueChange={(v) => navigate({ categoria: v === ALL ? "" : v })}
      >
        <SelectTrigger className="w-48" aria-label="Filtrar por categoría">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          <SelectItem value={ALL}>Todas las categorías</SelectItem>
          <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.tipo || ALL}
        onValueChange={(v) => navigate({ tipo: v === ALL ? "" : v })}
      >
        <SelectTrigger className="w-36" aria-label="Filtrar por tipo">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={ALL}>Todos los tipos</SelectItem>
          {PRODUCT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {PRODUCT_TYPE_SHORT_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Switch
          size="sm"
          checked={filters.inactivos}
          onCheckedChange={(v) => navigate({ inactivos: v })}
        />
        Mostrar inactivos
      </label>
    </div>
  );
}
