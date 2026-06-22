"use client";

// Carga perezosa de los gráficos (recharts es pesado, ~150-300KB). Así no
// infla el JS inicial de /reportes: los gráficos se cargan tras la hidratación.
// Nota Next 16: las opciones de next/dynamic deben ser un objeto LITERAL inline.

import dynamic from "next/dynamic";

function ChartLoading() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      Cargando gráfico…
    </div>
  );
}

export const MonthlyStageChart = dynamic(
  () => import("./report-charts").then((m) => m.MonthlyStageChart),
  { ssr: false, loading: ChartLoading }
);
export const DistributionPie = dynamic(
  () => import("./report-charts").then((m) => m.DistributionPie),
  { ssr: false, loading: ChartLoading }
);
export const ExecutiveChart = dynamic(
  () => import("./report-charts").then((m) => m.ExecutiveChart),
  { ssr: false, loading: ChartLoading }
);
export const EventTypeChart = dynamic(
  () => import("./report-charts").then((m) => m.EventTypeChart),
  { ssr: false, loading: ChartLoading }
);
