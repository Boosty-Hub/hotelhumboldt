"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDownWideNarrow } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListFilters } from "@/components/shared/list-filters";

export function ClientsToolbar({
  orden,
  showInactive,
}: {
  orden: "nombre" | "revenue";
  showInactive: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  // Búsqueda y rango de fechas los maneja ListFilters; aquí solo el orden y el
  // switch de inactivos, que son propios de Clientes. Lee la URL viva para no
  // pisar cambios concurrentes del otro escritor (ListFilters).
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

  return (
    <ListFilters
      searchPlaceholder="Buscar por razón social, marca o RIF…"
      searchAriaLabel="Buscar clientes"
      dateRange={{ label: "Registrado" }}
      extraParams={["orden", "inactivos"]}
    >
      <Select value={orden} onValueChange={(v) => apply({ orden: v === "nombre" ? null : v })}>
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
    </ListFilters>
  );
}
