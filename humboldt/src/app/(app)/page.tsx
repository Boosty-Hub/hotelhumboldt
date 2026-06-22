import Link from "next/link";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  formatDistanceToNow,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Cog,
  FileText,
  Inbox,
  Mail,
  Phone,
  StickyNote,
  Target,
  TrendingUp,
  Trophy,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { fmtPct, fmtUsd, round2 } from "@/lib/money";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/constants";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StageFunnelChart, type StageDatum } from "./dashboard-components/stage-chart";

export const metadata = { title: "Panel general" };

const OPEN_STAGES: Stage[] = ["NUEVO", "CONTACTADO", "PROPUESTA", "NEGOCIACION"];

// Colores hex para el gráfico (recharts no entiende clases Tailwind)
const STAGE_HEX: Record<Stage, string> = {
  NUEVO: "#0ea5e9",
  CONTACTADO: "#8b5cf6",
  PROPUESTA: "#f59e0b",
  NEGOCIACION: "#f97316",
  GANADO: "#10b981",
  PERDIDO: "#f43f5e",
};

const ACTIVITY_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  NOTA: { label: "Nota", icon: StickyNote, className: "bg-zinc-100 text-zinc-600" },
  LLAMADA: { label: "Llamada", icon: Phone, className: "bg-sky-100 text-sky-700" },
  EMAIL: { label: "Correo", icon: Mail, className: "bg-violet-100 text-violet-700" },
  REUNION: { label: "Reunión", icon: Users, className: "bg-amber-100 text-amber-700" },
  DEGUSTACION: {
    label: "Degustación",
    icon: UtensilsCrossed,
    className: "bg-emerald-100 text-emerald-700",
  },
  CAMBIO_ETAPA: {
    label: "Cambio de etapa",
    icon: ArrowRightLeft,
    className: "bg-orange-100 text-orange-700",
  },
  SISTEMA: { label: "Sistema", icon: Cog, className: "bg-zinc-100 text-zinc-500" },
};

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="truncate text-2xl font-bold tracking-tight">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{sub}</p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            iconClass
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);
  const in7Days = addDays(todayStart, 7);

  const [quotesMonth, closedMonth, openOpps, byStage, upcomingEvents, expiringQuotes, recentActivity] =
    await Promise.all([
      // Presupuestos emitidos este mes
      prisma.quote.findMany({
        where: { issueDate: { gte: monthStart, lte: monthEnd } },
        select: { totalUsd: true },
      }),
      // Oportunidades cerradas este mes (ganadas/perdidas — fecha aprox. por updatedAt)
      prisma.opportunity.findMany({
        where: {
          stage: { in: ["GANADO", "PERDIDO"] },
          updatedAt: { gte: monthStart, lte: monthEnd },
        },
        select: { stage: true, estimatedValue: true },
      }),
      // Pipeline activo (etapas abiertas)
      prisma.opportunity.findMany({
        where: { stage: { in: [...OPEN_STAGES] } },
        select: { estimatedValue: true, probability: true },
      }),
      // Embudo: conteo y valor por etapa
      prisma.opportunity.groupBy({
        by: ["stage"],
        _count: { _all: true },
        _sum: { estimatedValue: true },
      }),
      // Próximos eventos
      prisma.event.findMany({
        where: { startDate: { gte: todayStart }, status: { not: "CANCELADO" } },
        orderBy: { startDate: "asc" },
        take: 8,
        include: {
          opportunity: {
            select: {
              title: true,
              client: { select: { brandName: true, legalName: true } },
            },
          },
          reservations: {
            where: { status: { not: "CANCELADA" } },
            include: { space: { select: { name: true } } },
          },
        },
      }),
      // Cotizaciones ENVIADA con vencimiento en los próximos 7 días (o ya vencidas)
      prisma.quote.findMany({
        where: { status: "ENVIADA", validUntil: { not: null, lte: in7Days } },
        orderBy: { validUntil: "asc" },
        take: 8,
        include: {
          opportunity: {
            select: {
              title: true,
              client: { select: { brandName: true, legalName: true } },
            },
          },
        },
      }),
      // Actividad reciente
      prisma.activity.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { name: true } },
          opportunity: { select: { title: true } },
        },
      }),
    ]);

  // ── KPIs del mes ──────────────────────────────────────────────────
  const quotesCount = quotesMonth.length;
  const quotesUsd = round2(quotesMonth.reduce((acc, q) => acc + q.totalUsd, 0));

  const wonMonth = closedMonth.filter((o) => o.stage === "GANADO");
  const wonCount = wonMonth.length;
  const wonUsd = round2(wonMonth.reduce((acc, o) => acc + o.estimatedValue, 0));

  const closedCount = closedMonth.length;
  const conversionPct = closedCount > 0 ? round2((wonCount / closedCount) * 100) : null;

  const pipelineUsd = round2(
    openOpps.reduce((acc, o) => acc + o.estimatedValue * (o.probability / 100), 0)
  );

  const stageData: StageDatum[] = STAGES.map((s) => {
    const g = byStage.find((b) => b.stage === s);
    return {
      stage: s,
      label: STAGE_LABELS[s],
      count: g?._count._all ?? 0,
      value: round2(g?._sum.estimatedValue ?? 0),
      color: STAGE_HEX[s],
    };
  });

  // ── Saludo ────────────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = user?.name?.split(" ")[0] ?? "";
  const dateLabel = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const dateCapitalized = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const monthLabel = format(now, "MMMM", { locale: es });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{dateCapitalized}</p>
      </div>

      {/* KPIs del mes */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={`Presupuestos de ${monthLabel}`}
          value={String(quotesCount)}
          sub={`${fmtUsd(quotesUsd)} cotizados`}
          icon={FileText}
          iconClass="bg-sky-100 text-sky-700"
        />
        <KpiCard
          title="Oportunidades ganadas"
          value={String(wonCount)}
          sub={`${fmtUsd(wonUsd)} en valor estimado`}
          icon={Trophy}
          iconClass="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          title="Conversión del mes"
          value={conversionPct === null ? "—" : fmtPct(conversionPct)}
          sub={
            closedCount > 0
              ? `${wonCount} de ${closedCount} cerradas`
              : "Sin cierres este mes"
          }
          icon={Target}
          iconClass="bg-violet-100 text-violet-700"
        />
        <KpiCard
          title="Pipeline activo"
          value={fmtUsd(pipelineUsd)}
          sub={`${openOpps.length} oportunidades abiertas (ponderado)`}
          icon={TrendingUp}
          iconClass="bg-amber-100 text-amber-700"
        />
      </div>

      {/* Embudo + próximos eventos */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Oportunidades por etapa</CardTitle>
            <CardDescription>Embudo comercial de todas las oportunidades</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/pipeline">
                  Pipeline <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <StageFunnelChart data={stageData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Próximos eventos</CardTitle>
            <CardDescription>Eventos confirmados o en planificación</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/calendario">
                  Calendario <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No hay eventos próximos.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/calendario">Ir al calendario</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {upcomingEvents.map((ev) => {
                  const d = ev.startDate!;
                  const clientName =
                    ev.opportunity.client.brandName ?? ev.opportunity.client.legalName;
                  const salones = [...new Set(ev.reservations.map((r) => r.space.name))];
                  return (
                    <li key={ev.id}>
                      <Link
                        href={`/eventos/${ev.id}`}
                        className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/60"
                      >
                        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-sky-100 bg-sky-50 text-sky-950">
                          <span className="text-sm font-bold leading-none">{format(d, "d")}</span>
                          <span className="text-[10px] uppercase leading-tight">
                            {format(d, "MMM", { locale: es })}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium group-hover:underline">
                            {ev.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {clientName}
                            {salones.length > 0 ? ` · ${salones.join(", ")}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {ev.datesTentative && (
                            <Badge variant="outline" className="text-amber-700">
                              Tentativa
                            </Badge>
                          )}
                          {ev.pax != null && (
                            <Badge variant="secondary">
                              {ev.pax}
                              {ev.paxApproximate ? "±" : ""} pax
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cotizaciones por vencer + actividad reciente */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cotizaciones por vencer</CardTitle>
            <CardDescription>Enviadas con vigencia en los próximos 7 días</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/cotizaciones">
                  Ver todas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {expiringQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
                <p className="text-sm text-muted-foreground">
                  Ninguna cotización vence en los próximos 7 días.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Vence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringQuotes.map((q) => {
                    const validUntil = q.validUntil!;
                    const expired = validUntil < todayStart;
                    const daysLeft = differenceInCalendarDays(validUntil, now);
                    const clientName =
                      q.opportunity.client.brandName ?? q.opportunity.client.legalName;
                    return (
                      <TableRow key={q.id} className={cn(expired && "bg-rose-50/60")}>
                        <TableCell className="font-medium">{q.number}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{clientName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtUsd(q.totalUsd)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-xs font-medium",
                              expired ? "text-rose-600" : "text-amber-700"
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {expired
                              ? `Venció ${format(validUntil, "d MMM", { locale: es })}`
                              : daysLeft === 0
                                ? "Hoy"
                                : `${daysLeft} d (${format(validUntil, "d MMM", { locale: es })})`}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Últimos movimientos del equipo comercial</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Sin actividad registrada aún.</p>
              </div>
            ) : (
              <ul className="divide-y">
                {recentActivity.map((a) => {
                  const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.NOTA;
                  const Icon = meta.icon;
                  return (
                    <li key={a.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          meta.className
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm">{a.body}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.user.name} · {meta.label}
                          {a.opportunity ? ` · ${a.opportunity.title}` : ""} ·{" "}
                          {formatDistanceToNow(a.createdAt, { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
