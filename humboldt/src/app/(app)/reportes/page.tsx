import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { Lock, PieChart as PieChartIcon, TrendingUp, Trophy, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth, canViewCosts } from "@/lib/auth";
import { fmtPct, fmtUsd, round2 } from "@/lib/money";
import { calcQuoteTotals } from "@/lib/quote-calc";
import { STAGES, type Stage } from "@/lib/constants";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RangeFilter } from "./range-filter";
import {
  DistributionPie,
  EventTypeChart,
  ExecutiveChart,
  MonthlyStageChart,
  type CountDatum,
  type ExecutiveDatum,
  type MonthlyStageDatum,
  type PieDatum,
} from "./report-charts";

export const metadata = { title: "Reportes" };

const WON_QUOTE_STATUSES = ["APROBADA", "CONTRATADA"];

interface MonthlyRow {
  key: string;
  label: string;
  realizadosCount: number;
  realizadosUsd: number;
  ganadosCount: number;
  ganadosUsd: number;
  arrastreCount: number;
  arrastreUsd: number;
  rechazadosCount: number;
  rechazadosUsd: number;
  sinRespuestaCount: number;
  sinRespuestaUsd: number;
  conversionPct: number | null;
}

function parseMonthParam(value: string | undefined, fallback: Date): Date {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) return new Date(y, m - 1, 1);
  }
  return fallback;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Celda compuesta: # arriba, $ debajo en gris. */
function CountUsdCell({ count, usd }: { count: number; usd: number }) {
  return (
    <div className="leading-tight">
      <p className="font-semibold tabular-nums">{count}</p>
      <p className="text-[11px] tabular-nums text-muted-foreground">{fmtUsd(usd)}</p>
    </div>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const showCosts = canViewCosts(session?.user?.role);
  const sp = await searchParams;

  const now = new Date();
  // Default: año actual completo
  let from = parseMonthParam(
    typeof sp.desde === "string" ? sp.desde : undefined,
    new Date(now.getFullYear(), 0, 1)
  );
  let to = parseMonthParam(
    typeof sp.hasta === "string" ? sp.hasta : undefined,
    new Date(now.getFullYear(), 11, 1)
  );
  if (from > to) [from, to] = [to, from];
  // Máximo 36 meses para mantener la tabla legible
  if (differenceInCalendarDays(to, from) > 366 * 3) from = subMonths(to, 35);

  const rangeStart = startOfMonth(from);
  const rangeEnd = endOfMonth(to);
  const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });

  const desdeStr = format(from, "yyyy-MM");
  const hastaStr = format(to, "yyyy-MM");
  const rangeLabel = `${capitalize(format(from, "MMMM yyyy", { locale: es }))} — ${capitalize(
    format(to, "MMMM yyyy", { locale: es })
  )}`;

  const [quotes, opportunities, marginQuotes] = await Promise.all([
    // Todas las cotizaciones (dataset pequeño; la lógica de cohortes se hace en JS)
    prisma.quote.findMany({
      select: {
        id: true,
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
      select: {
        id: true,
        stage: true,
        estimatedValue: true,
        createdAt: true,
        updatedAt: true,
        lostReason: true,
        channel: true,
        eventType: true,
        owner: { select: { name: true } },
      },
    }),
    // Margen interno: solo si el rol puede ver costos
    showCosts
      ? prisma.quote.findMany({
          where: {
            status: { in: WON_QUOTE_STATUSES },
            issueDate: { gte: rangeStart, lte: rangeEnd },
          },
          include: { lines: true },
        })
      : Promise.resolve([]),
  ]);

  // ── Tabla mensual (réplica del Excel "Resumen") ─────────────────────
  // Fecha de "ganada" de una cotización: aprobación del cliente → fecha de
  // acuerdo → última actualización (aproximación).
  const wonDate = (q: (typeof quotes)[number]) =>
    q.approvedAt ?? q.agreementDate ?? q.updatedAt;

  const rows: MonthlyRow[] = months.map((m) => {
    const realizados = quotes.filter((q) => isSameMonth(q.issueDate, m));

    const wonInMonth = quotes.filter(
      (q) => WON_QUOTE_STATUSES.includes(q.status) && isSameMonth(wonDate(q), m)
    );
    const ganados = wonInMonth.filter((q) => isSameMonth(q.createdAt, m));
    const arrastre = wonInMonth.filter(
      (q) => !isSameMonth(q.createdAt, m) && q.createdAt < startOfMonth(m)
    );

    const rechazados = quotes.filter(
      (q) => q.status === "RECHAZADA" && isSameMonth(q.updatedAt, m)
    );

    // Enviadas en el mes que siguen ENVIADA sin movimiento hace más de 30 días
    const sinRespuesta = quotes.filter(
      (q) =>
        q.status === "ENVIADA" &&
        isSameMonth(q.issueDate, m) &&
        differenceInCalendarDays(now, q.updatedAt) > 30
    );

    const ganadosTotal = wonInMonth.length;
    const cerradas = ganadosTotal + rechazados.length;
    const conversionPct = cerradas > 0 ? round2((ganadosTotal / cerradas) * 100) : null;

    const sum = (list: { totalUsd: number }[]) =>
      round2(list.reduce((acc, q) => acc + q.totalUsd, 0));

    return {
      key: format(m, "yyyy-MM"),
      label: capitalize(format(m, "MMMM yyyy", { locale: es })),
      realizadosCount: realizados.length,
      realizadosUsd: sum(realizados),
      ganadosCount: ganados.length,
      ganadosUsd: sum(ganados),
      arrastreCount: arrastre.length,
      arrastreUsd: sum(arrastre),
      rechazadosCount: rechazados.length,
      rechazadosUsd: sum(rechazados),
      sinRespuestaCount: sinRespuesta.length,
      sinRespuestaUsd: sum(sinRespuesta),
      conversionPct,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      realizadosCount: acc.realizadosCount + r.realizadosCount,
      realizadosUsd: round2(acc.realizadosUsd + r.realizadosUsd),
      ganadosCount: acc.ganadosCount + r.ganadosCount,
      ganadosUsd: round2(acc.ganadosUsd + r.ganadosUsd),
      arrastreCount: acc.arrastreCount + r.arrastreCount,
      arrastreUsd: round2(acc.arrastreUsd + r.arrastreUsd),
      rechazadosCount: acc.rechazadosCount + r.rechazadosCount,
      rechazadosUsd: round2(acc.rechazadosUsd + r.rechazadosUsd),
      sinRespuestaCount: acc.sinRespuestaCount + r.sinRespuestaCount,
      sinRespuestaUsd: round2(acc.sinRespuestaUsd + r.sinRespuestaUsd),
    }),
    {
      realizadosCount: 0,
      realizadosUsd: 0,
      ganadosCount: 0,
      ganadosUsd: 0,
      arrastreCount: 0,
      arrastreUsd: 0,
      rechazadosCount: 0,
      rechazadosUsd: 0,
      sinRespuestaCount: 0,
      sinRespuestaUsd: 0,
    }
  );
  const totalWon = totals.ganadosCount + totals.arrastreCount;
  const totalClosed = totalWon + totals.rechazadosCount;
  const totalConversion = totalClosed > 0 ? round2((totalWon / totalClosed) * 100) : null;

  // ── Datos para gráficos ─────────────────────────────────────────────
  const inRange = (d: Date) => d >= rangeStart && d <= rangeEnd;
  const oppsCreatedInRange = opportunities.filter((o) => inRange(o.createdAt));

  const monthlyStageData: MonthlyStageDatum[] = months.map((m) => {
    const row: MonthlyStageDatum = {
      month: capitalize(format(m, "MMM yy", { locale: es })),
    };
    for (const s of STAGES) {
      row[s as Stage] = oppsCreatedInRange.filter(
        (o) => o.stage === s && isSameMonth(o.createdAt, m)
      ).length;
    }
    return row;
  });

  const countBy = <T,>(items: T[], key: (t: T) => string): PieDatum[] => {
    const map = new Map<string, number>();
    for (const it of items) {
      const k = key(it);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    );
  };

  const lostOpps = opportunities.filter((o) => o.stage === "PERDIDO" && inRange(o.updatedAt));
  const lostReasonData: PieDatum[] = countBy(
    lostOpps,
    (o) => o.lostReason?.trim() || "Sin especificar"
  );

  const wonOpps = opportunities.filter((o) => o.stage === "GANADO" && inRange(o.updatedAt));
  const executiveMap = new Map<string, { total: number; count: number }>();
  for (const o of wonOpps) {
    const cur = executiveMap.get(o.owner.name) ?? { total: 0, count: 0 };
    executiveMap.set(o.owner.name, {
      total: cur.total + o.estimatedValue,
      count: cur.count + 1,
    });
  }
  const executiveData: ExecutiveDatum[] = Array.from(executiveMap, ([name, v]) => ({
    name,
    total: round2(v.total),
    count: v.count,
  })).sort((a, b) => b.total - a.total);

  const channelData: PieDatum[] = countBy(
    oppsCreatedInRange,
    (o) => o.channel?.trim() || "Sin canal"
  );

  const eventTypeData: CountDatum[] = countBy(
    oppsCreatedInRange,
    (o) => o.eventType?.trim() || "Sin tipo"
  )
    .slice(0, 10)
    .map(({ name, value }) => ({ name, count: value }));

  // ── Margen bruto (solo gerencia/admin) ──────────────────────────────
  let margin: {
    quotesCount: number;
    totalMargin: number;
    totalCost: number;
    weightedPct: number;
    avgPct: number;
  } | null = null;
  if (showCosts) {
    const computed = marginQuotes.map((q) =>
      calcQuoteTotals(q.lines, {
        taxPct: q.taxPct,
        taxEnabled: q.taxEnabled,
        servicePct: q.servicePct,
        serviceEnabled: q.serviceEnabled,
        depositPct: q.depositPct,
        depositEnabled: q.depositEnabled,
        igtfPct: q.igtfPct,
        igtfEnabled: q.igtfEnabled,
      })
    );
    const totalMargin = round2(computed.reduce((acc, t) => acc + t.grossMargin, 0));
    const totalCost = round2(computed.reduce((acc, t) => acc + t.totalCost, 0));
    const totalRevenue = round2(
      computed.reduce((acc, t) => acc + t.taxableBase + t.subtotalTransfers, 0)
    );
    margin = {
      quotesCount: computed.length,
      totalMargin,
      totalCost,
      weightedPct: totalRevenue > 0 ? round2((totalMargin / totalRevenue) * 100) : 0,
      avgPct: computed.length
        ? round2(computed.reduce((acc, t) => acc + t.grossMarginPct, 0) / computed.length)
        : 0,
    };
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            Resumen comercial · {rangeLabel}
          </p>
        </div>
      </div>

      {/* Filtro de rango */}
      <Card size="sm">
        <CardContent>
          <RangeFilter desde={desdeStr} hasta={hastaStr} />
        </CardContent>
      </Card>

      {/* Tabla mensual */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen mensual de presupuestos</CardTitle>
          <CardDescription>
            Presupuestos emitidos, ganados (mismo mes y arrastre), rechazados y sin
            respuesta (&gt;30 días sin movimiento) — montos en USD
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead>Presupuestos</TableHead>
                  <TableHead>Ganados (mismo mes)</TableHead>
                  <TableHead>De arrastre</TableHead>
                  <TableHead>Rechazados</TableHead>
                  <TableHead>Sin respuesta</TableHead>
                  <TableHead className="text-right">Conversión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell>
                      <CountUsdCell count={r.realizadosCount} usd={r.realizadosUsd} />
                    </TableCell>
                    <TableCell>
                      <CountUsdCell count={r.ganadosCount} usd={r.ganadosUsd} />
                    </TableCell>
                    <TableCell>
                      <CountUsdCell count={r.arrastreCount} usd={r.arrastreUsd} />
                    </TableCell>
                    <TableCell>
                      <CountUsdCell count={r.rechazadosCount} usd={r.rechazadosUsd} />
                    </TableCell>
                    <TableCell>
                      <CountUsdCell count={r.sinRespuestaCount} usd={r.sinRespuestaUsd} />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.conversionPct === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            r.conversionPct >= 50
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }
                        >
                          {fmtPct(r.conversionPct)}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell>
                    <CountUsdCell count={totals.realizadosCount} usd={totals.realizadosUsd} />
                  </TableCell>
                  <TableCell>
                    <CountUsdCell count={totals.ganadosCount} usd={totals.ganadosUsd} />
                  </TableCell>
                  <TableCell>
                    <CountUsdCell count={totals.arrastreCount} usd={totals.arrastreUsd} />
                  </TableCell>
                  <TableCell>
                    <CountUsdCell count={totals.rechazadosCount} usd={totals.rechazadosUsd} />
                  </TableCell>
                  <TableCell>
                    <CountUsdCell
                      count={totals.sinRespuestaCount}
                      usd={totals.sinRespuestaUsd}
                    />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {totalConversion === null ? "—" : fmtPct(totalConversion)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Margen bruto — SOLO roles con acceso a costos */}
      {margin && (
        <Card className="border-amber-200/70 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              Margen bruto de cotizaciones ganadas
            </CardTitle>
            <CardDescription>
              Cotizaciones aprobadas o contratadas emitidas en el rango — cálculo sobre
              costos internos de proveedor
            </CardDescription>
            <CardAction>
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                Información interna
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {margin.quotesCount === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No hay cotizaciones aprobadas o contratadas en el rango seleccionado.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Margen bruto total</p>
                  <p className="text-xl font-bold tabular-nums text-emerald-700">
                    {fmtUsd(margin.totalMargin)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margen ponderado</p>
                  <p className="text-xl font-bold tabular-nums">{fmtPct(margin.weightedPct)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margen promedio por cotización</p>
                  <p className="text-xl font-bold tabular-nums">{fmtPct(margin.avgPct)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Costo total · {margin.quotesCount}{" "}
                    {margin.quotesCount === 1 ? "cotización" : "cotizaciones"}
                  </p>
                  <p className="text-xl font-bold tabular-nums text-rose-700">
                    {fmtUsd(margin.totalCost)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Oportunidades por mes y etapa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-sky-700" />
            Oportunidades por mes y etapa
          </CardTitle>
          <CardDescription>
            Oportunidades creadas en cada mes según su etapa actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyStageChart data={monthlyStageData} />
        </CardContent>
      </Card>

      {/* Pérdidas y canales */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-3.5 w-3.5 text-rose-600" />
              Motivos de pérdida
            </CardTitle>
            <CardDescription>
              Oportunidades perdidas en el rango ({lostOpps.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionPie data={lostReasonData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-3.5 w-3.5 text-sky-700" />
              Canal de ingreso
            </CardTitle>
            <CardDescription>
              Origen de las oportunidades creadas en el rango ({oppsCreatedInRange.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DistributionPie data={channelData} />
          </CardContent>
        </Card>
      </div>

      {/* Ejecutivos y tipos de evento */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-sky-700" />
              Ranking por ejecutivo
            </CardTitle>
            <CardDescription>
              Valor estimado de oportunidades ganadas en el rango
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExecutiveChart data={executiveData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-amber-600" />
              Top 10 tipos de evento
            </CardTitle>
            <CardDescription>
              Tipos de evento más solicitados en el rango
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventTypeChart data={eventTypeData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
