"use client";

// Filtro de rango de meses para /reportes — navega con searchParams.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, subMonths } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RangeFilter({ desde, hasta }: { desde: string; hasta: string }) {
  const router = useRouter();
  const [d, setD] = useState(desde);
  const [h, setH] = useState(hasta);
  const [isPending, startTransition] = useTransition();

  const apply = (nd: string, nh: string) => {
    setD(nd);
    setH(nh);
    startTransition(() => {
      router.push(`/reportes?desde=${nd}&hasta=${nh}`);
    });
  };

  const now = new Date();
  const year = now.getFullYear();
  const presets: { label: string; desde: string; hasta: string }[] = [
    { label: "Este año", desde: `${year}-01`, hasta: `${year}-12` },
    {
      label: "Últimos 6 meses",
      desde: format(subMonths(now, 5), "yyyy-MM"),
      hasta: format(now, "yyyy-MM"),
    },
    { label: "Año anterior", desde: `${year - 1}-01`, hasta: `${year - 1}-12` },
  ];

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply(d, h);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="desde" className="text-xs">
          Mes inicio
        </Label>
        <Input
          id="desde"
          type="month"
          value={d}
          max={h}
          onChange={(e) => setD(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="hasta" className="text-xs">
          Mes fin
        </Label>
        <Input
          id="hasta"
          type="month"
          value={h}
          min={d}
          onChange={(e) => setH(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>
      <Button type="submit" size="sm" className="h-9 bg-sky-950 hover:bg-sky-900" disabled={isPending}>
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Aplicar
      </Button>
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={isPending}
            onClick={() => apply(p.desde, p.hasta)}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
