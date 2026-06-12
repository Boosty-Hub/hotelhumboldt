"use client";

// Embudo de oportunidades por etapa — client component (recharts).
// Recibe los datos ya serializados desde el Server Component del dashboard.

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtUsd } from "@/lib/money";

export interface StageDatum {
  stage: string;
  label: string;
  count: number;
  value: number; // USD estimado de la etapa
  color: string;
}

function StageTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: StageDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{d.label}</p>
      <p className="text-muted-foreground">
        {d.count} {d.count === 1 ? "oportunidad" : "oportunidades"}
      </p>
      <p className="font-medium">{fmtUsd(d.value)} estimado</p>
    </div>
  );
}

export function StageFunnelChart({ data }: { data: StageDatum[] }) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  if (total === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Aún no hay oportunidades registradas.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 36, bottom: 4, left: 4 }}
        barCategoryGap={10}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={100}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<StageTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="count" radius={[4, 4, 4, 4]} maxBarSize={26}>
          {data.map((d) => (
            <Cell key={d.stage} fill={d.color} />
          ))}
          <LabelList dataKey="count" position="right" fontSize={12} fill="#3f3f46" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
