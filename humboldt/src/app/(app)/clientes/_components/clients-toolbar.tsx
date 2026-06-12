"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownWideNarrow, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClientsToolbar({
  q,
  orden,
  showInactive,
}: {
  q: string;
  orden: "nombre" | "revenue";
  showInactive: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(q);
  const [pending, startTransition] = useTransition();
  const firstRender = useRef(true);

  function apply(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // Búsqueda con debounce (server-side vía searchParams)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if ((params.get("q") ?? "") !== search.trim()) {
        apply({ q: search.trim() || null });
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs">
        {pending ? (
          <Loader2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por razón social, marca o RIF…"
          className="pl-8"
          aria-label="Buscar clientes"
        />
      </div>

      <Select
        value={orden}
        onValueChange={(v) => apply({ orden: v === "nombre" ? null : v })}
      >
        <SelectTrigger aria-label="Ordenar clientes">
          <ArrowDownWideNarrow className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nombre">Nombre (A–Z)</SelectItem>
          <SelectItem value="revenue">Mayor revenue</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Switch
          id="inactivos"
          checked={showInactive}
          onCheckedChange={(checked) => apply({ inactivos: checked ? "1" : null })}
        />
        <Label htmlFor="inactivos" className="text-xs text-muted-foreground">
          Mostrar inactivos
        </Label>
      </div>
    </div>
  );
}
