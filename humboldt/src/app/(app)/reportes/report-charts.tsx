"use client";

// Gráficos de /reportes — client components (recharts).
// Todos reciben datos planos (string/number) serializados desde el servidor.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { fmtUsd } from "@/lib/money";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/constants";

// Colores hex (recharts no entiende clases Tailwind)
const STAGE_HEX: Record<Stage, string> = {
  NUEVO: "#0ea5e9",
  CONTACTADO: "#8b5cf6",
  PROPUESTA: "#f59e0b",
  NEGOCIACION: "#f97316",
  GANADO: "#10b981",
  PERDIDO: "#f43f5e",
};

const PALETTE = [
  "#0c4a6e", // sky-950 (acento)
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
  "#f97316",
  "#14b8a6",
  "#6366f1",
  "#a3a3a3",
];

function ChartEmpty({ height = 260 }: { height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-center"
      style={{ height }}
    >
      <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Sin datos en el rango seleccionado.</p>
    </div>
  );
}

// ── Barras apiladas: oportunidades por mes y etapa ─────────────────────
export type MonthlyStageDatum = { month: string } & Partial<Record<Stage, number>>;

export function MonthlyStageChart({ data }: { data: MonthlyStageDatum[] }) {
  const hasData = data.some((row) => STAGES.some((s) => Number(row[s] ?? 0) > 0));
  if (!hasData) return <ChartEmpty height={300} />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis
          allowDecimals={false}
          width={32}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {STAGES.map((s) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="etapas"
            name={STAGE_LABELS[s]}
            fill={STAGE_HEX[s]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Pie genérico (motivos de pérdida, canal de ingreso) ────────────────
export interface PieDatum {
  name: string;
  value: number;
}

export function DistributionPie({ data }: { data: PieDatum[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
          strokeWidth={0}
        >
          {filtered.map((d, i) => (
            <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Barras horizontales por ejecutivo (ganado $ y #) ───────────────────
export interface ExecutiveDatum {
  name: string;
  total: number; // USD ganado
  count: number; // # oportunidades ganadas
}

function ExecutiveTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ExecutiveDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{d.name}</p>
      <p className="font-medium">{fmtUsd(d.total)} ganado</p>
      <p className="text-muted-foreground">
        {d.count} {d.count === 1 ? "oportunidad" : "oportunidades"}
      </p>
    </div>
  );
}

export function ExecutiveChart({ data }: { data: ExecutiveDatum[] }) {
  if (!data.length) return <ChartEmpty />;
  const height = Math.max(220, data.length * 48);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 90, bottom: 4, left: 4 }}
        barCategoryGap={10}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<ExecutiveTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="total" fill="#0c4a6e" radius={[4, 4, 4, 4]} maxBarSize={22}>
          <LabelList
            dataKey="total"
            position="right"
            fontSize={11}
            fill="#3f3f46"
            formatter={(v: unknown) => fmtUsd(Number(v))}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Top tipos de evento (barras horizontales por #) ────────────────────
export interface CountDatum {
  name: string;
  count: number;
}

function CountTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CountDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">
        {d.count} {d.count === 1 ? "oportunidad" : "oportunidades"}
      </p>
    </div>
  );
}

export function EventTypeChart({ data }: { data: CountDatum[] }) {
  if (!data.length) return <ChartEmpty />;
  const height = Math.max(220, data.length * 36);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 36, bottom: 4, left: 4 }}
        barCategoryGap={8}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CountTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 4, 4]} maxBarSize={20}>
          <LabelList dataKey="count" position="right" fontSize={11} fill="#3f3f46" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
