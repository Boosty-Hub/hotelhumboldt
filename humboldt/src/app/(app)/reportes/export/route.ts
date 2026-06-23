import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/money";
import { buildMonthlyRows, buildTotals } from "@/lib/report-cohort";
import { getGoals } from "@/lib/settings";
import { segmentOfEventType } from "@/lib/segments";
import { isGarantiaMovement } from "../../pagos/data";

/**
 * Exporta los indicadores del informe de gestión + la tabla mensual como CSV
 * (UTF-8 con BOM, separador ';', coma decimal → abre directo en Excel español).
 * Respeta el rango ?desde=YYYY-MM&hasta=YYYY-MM de la pantalla /reportes.
 */
function parseMonthParam(value: string | null, fallback: Date): Date {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) return new Date(y, m - 1, 1);
  }
  return fallback;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("No autorizado", { status: 401 });

  const url = new URL(req.url);
  const now = new Date();
  let from = parseMonthParam(url.searchParams.get("desde"), new Date(now.getFullYear(), 0, 1));
  let to = parseMonthParam(url.searchParams.get("hasta"), new Date(now.getFullYear(), 11, 1));
  if (from > to) [from, to] = [to, from];
  if (differenceInCalendarDays(to, from) > 366 * 3) from = subMonths(to, 35);

  const rangeStart = startOfMonth(from);
  const rangeEnd = endOfMonth(to);
  const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
  const rangeLabel = `${capitalize(format(from, "MMMM yyyy", { locale: es }))} — ${capitalize(
    format(to, "MMMM yyyy", { locale: es })
  )}`;

  const [quotes, opportunities, payments, spacesConfirmadas, goals] = await Promise.all([
    prisma.quote.findMany({
      select: {
        status: true,
        issueDate: true,
        totalUsd: true,
        createdAt: true,
        updatedAt: true,
        approvedAt: true,
        agreementDate: true,
      },
    }),
    prisma.opportunity.findMany({
      where: { stage: "GANADO", updatedAt: { gte: rangeStart, lte: rangeEnd } },
      select: { eventType: true, segment: true },
    }),
    prisma.payment.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
      select: { amountUsd: true, type: true, notes: true },
    }),
    prisma.spaceReservation.count({
      where: { status: "CONFIRMADA", date: { gte: rangeStart, lte: rangeEnd } },
    }),
    getGoals(),
  ]);

  const rows = buildMonthlyRows(quotes, months, now);
  const totals = buildTotals(rows);
  const cobranzaReal = round2(
    payments.filter((p) => !isGarantiaMovement(p)).reduce((acc, p) => acc + p.amountUsd, 0)
  );

  const segmentMap = new Map<string, number>();
  for (const o of opportunities) {
    const seg = o.segment?.trim() ? o.segment.trim() : segmentOfEventType(o.eventType);
    segmentMap.set(seg, (segmentMap.get(seg) ?? 0) + 1);
  }

  const ventaPctMeta =
    goals.monthlySales > 0 ? round2((cobranzaReal / goals.monthlySales) * 100) : null;
  const espaciosPctMeta =
    goals.monthlySpaces > 0 ? round2((spacesConfirmadas / goals.monthlySpaces) * 100) : null;

  // Número con coma decimal (Excel español); vacío si null.
  const n = (x: number | null) => (x == null ? "" : x.toFixed(2).replace(".", ","));
  const esc = (s: string) => (/[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  const out: string[][] = [
    ["Informe de Gestión — Indicadores"],
    ["Período", rangeLabel],
    ["Generado", format(now, "dd/MM/yyyy HH:mm")],
    [],
    ["Indicadores del período"],
    ["Indicador", "Valor", "Meta", "Cumplimiento %"],
    ["Valor de presupuestos (USD)", n(totals.realizadosUsd), "", ""],
    ["Solicitudes cotizadas (#)", String(totals.realizadosCount), "", ""],
    [
      "Venta ejecutada / cobranza (USD)",
      n(cobranzaReal),
      n(goals.monthlySales),
      n(ventaPctMeta),
    ],
    [
      "Cotizaciones ganadas (USD)",
      n(round2(totals.ganadosUsd + totals.arrastreUsd)),
      "",
      "",
    ],
    ["Cotizaciones ganadas (#)", String(totals.totalWon), "", ""],
    ["Conversión (%)", n(totals.totalConversion), n(goals.conversionPct), ""],
    [
      "Espacios comercializados (#)",
      String(spacesConfirmadas),
      String(goals.monthlySpaces),
      n(espaciosPctMeta),
    ],
    [],
    ["Estatus operativo de solicitudes"],
    ["Estatus", "Cantidad", "Monto USD"],
    ["Ganados (mismo mes)", String(totals.ganadosCount), n(totals.ganadosUsd)],
    ["Ganados de arrastre", String(totals.arrastreCount), n(totals.arrastreUsd)],
    ["Rechazados", String(totals.rechazadosCount), n(totals.rechazadosUsd)],
    ["Sin respuesta", String(totals.sinRespuestaCount), n(totals.sinRespuestaUsd)],
    [],
    ["Eventos ganados por segmento"],
    ["Segmento", "Cantidad"],
    ...Array.from(segmentMap, ([seg, count]) => [seg, String(count)]),
    [],
    ["Resumen mensual de presupuestos"],
    [
      "Mes",
      "Presupuestos #",
      "Presupuestos USD",
      "Ganados #",
      "Ganados USD",
      "Arrastre #",
      "Arrastre USD",
      "Rechazados #",
      "Rechazados USD",
      "Sin respuesta #",
      "Sin respuesta USD",
      "Conversión %",
    ],
    ...rows.map((r) => [
      r.label,
      String(r.realizadosCount),
      n(r.realizadosUsd),
      String(r.ganadosCount),
      n(r.ganadosUsd),
      String(r.arrastreCount),
      n(r.arrastreUsd),
      String(r.rechazadosCount),
      n(r.rechazadosUsd),
      String(r.sinRespuestaCount),
      n(r.sinRespuestaUsd),
      n(r.conversionPct),
    ]),
    [
      "TOTAL",
      String(totals.realizadosCount),
      n(totals.realizadosUsd),
      String(totals.ganadosCount),
      n(totals.ganadosUsd),
      String(totals.arrastreCount),
      n(totals.arrastreUsd),
      String(totals.rechazadosCount),
      n(totals.rechazadosUsd),
      String(totals.sinRespuestaCount),
      n(totals.sinRespuestaUsd),
      n(totals.totalConversion),
    ],
  ];

  const csv = "﻿" + out.map((r) => r.map((c) => esc(String(c ?? ""))).join(";")).join("\r\n");
  const fileTag = `${format(from, "yyyy-MM")}_${format(to, "yyyy-MM")}`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="informe-gestion-${fileTag}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
