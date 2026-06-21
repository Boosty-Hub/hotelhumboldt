import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtUsd } from "@/lib/money";
import { formatDayEs } from "@/lib/dates";
import {
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  type QuoteStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  FileText,
  FileSignature,
  ScrollText,
  TrendingUp,
  Wallet,
  KanbanSquare,
  ClipboardList,
  MapPin,
  CalendarDays,
  History,
} from "lucide-react";

export const metadata = { title: "Expediente del evento" };

function quoteBase(n: string) {
  return n.replace(/-V\d+$/, "");
}

export default async function ExpedienteEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      opportunity: { include: { client: true, contact: true } },
      quotes: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          number: true,
          version: true,
          status: true,
          totalUsd: true,
          createdAt: true,
        },
      },
      reservations: {
        orderBy: { date: "asc" },
        include: { space: { select: { name: true } } },
      },
      beo: { select: { id: true } },
    },
  });
  if (!event) notFound();

  const client = event.opportunity.client;
  const opp = event.opportunity;

  // Histórico: otros eventos del mismo cliente.
  const otherEvents = await prisma.event.findMany({
    where: { opportunity: { clientId: client.id }, id: { not: event.id } },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: {
      opportunity: { select: { code: true } },
      quotes: { select: { totalUsd: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    take: 20,
  });

  // Línea de tiempo de la oportunidad.
  const activities = await prisma.activity.findMany({
    where: { opportunityId: opp.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { user: { select: { name: true } } },
  });

  const dateLabel = event.startDate
    ? formatDayEs(event.startDate, "EEEE d 'de' MMMM 'de' yyyy")
    : "Fecha por definir";
  const timeLabel = event.startTime
    ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}`
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={`/clientes/${client.id}`} aria-label="Volver al cliente">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold tracking-tight">{event.name}</h1>
            <Badge variant="outline">{event.status}</Badge>
            {event.datesTentative && (
              <Badge variant="outline" className="text-amber-700">
                fechas por confirmar
              </Badge>
            )}
          </div>
          <p className="ml-8 text-sm text-muted-foreground">
            Expediente del evento · {client.brandName ?? client.legalName} · {opp.code}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/pipeline/${opp.id}`}>
              <KanbanSquare className="h-3.5 w-3.5" />
              Oportunidad
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/pagos/oportunidad/${opp.id}`}>
              <Wallet className="h-3.5 w-3.5" />
              Pagos
            </Link>
          </Button>
          {event.beo && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/beo/${event.beo.id}`}>
                <ClipboardList className="h-3.5 w-3.5" />
                BEO
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Datos del evento + cliente */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Evento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {dateLabel}
              {timeLabel && <span className="text-muted-foreground">· {timeLabel}</span>}
            </p>
            {event.pax != null && (
              <p className="text-muted-foreground">
                {event.pax} invitados{event.paxApproximate ? " (aprox.)" : ""}
              </p>
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 text-sm">
            <p className="font-medium">{client.legalName}</p>
            {client.rif && <p className="text-xs text-muted-foreground">RIF {client.rif}</p>}
            {opp.contact && (
              <p className="text-xs text-muted-foreground">Contacto: {opp.contact.name}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cotizaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cotizaciones</CardTitle>
          <CardDescription>{event.quotes.length} en este evento</CardDescription>
        </CardHeader>
        <CardContent>
          {event.quotes.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Sin cotizaciones todavía.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      {quoteBase(q.number)}
                      {q.version > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">v{q.version}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(QUOTE_STATUS_COLORS[q.status as QuoteStatus])}
                      >
                        {QUOTE_STATUS_LABELS[q.status as QuoteStatus] ?? q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(q.totalUsd)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/cotizaciones/${q.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Documentos</CardTitle>
          <CardDescription>Se generan auto-rellenados; el contenido es fijo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/documentos/contrato">
              <FileSignature className="h-3.5 w-3.5" />
              Contrato de evento
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/documentos/reglamento">
              <ScrollText className="h-3.5 w-3.5" />
              Reglamento
            </Link>
          </Button>
          {event.quotes[0] && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/cotizaciones/${event.quotes[0].id}/costos`}>
                <TrendingUp className="h-3.5 w-3.5" />
                Análisis de costos
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Reservas de salón */}
      {event.reservations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Reservas de salón</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {event.reservations.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {r.space.name} · {formatDayEs(r.date, "d MMM yyyy")}
                </span>
                <Badge variant="outline">
                  {RESERVATION_STATUS_LABELS[r.status as keyof typeof RESERVATION_STATUS_LABELS] ??
                    r.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico del cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <History className="h-3.5 w-3.5" />
            Histórico del cliente
          </CardTitle>
          <CardDescription>
            {otherEvents.length === 0
              ? "Primer evento de este cliente."
              : `${otherEvents.length} evento(s) anterior(es) de ${client.brandName ?? client.legalName}`}
          </CardDescription>
        </CardHeader>
        {otherEvents.length > 0 && (
          <CardContent className="space-y-1.5 text-sm">
            {otherEvents.map((e) => (
              <Link
                key={e.id}
                href={`/eventos/${e.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <span>
                  {e.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {e.startDate ? formatDayEs(e.startDate, "d MMM yyyy") : "sin fecha"} · {e.opportunity.code}
                  </span>
                </span>
                {e.quotes[0] && (
                  <span className="tabular-nums text-muted-foreground">
                    {fmtUsd(e.quotes[0].totalUsd)}
                  </span>
                )}
              </Link>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Línea de tiempo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Línea de tiempo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {activities.length === 0 ? (
            <p className="py-2 text-center text-muted-foreground">Sin actividad registrada.</p>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="flex gap-2 border-b border-zinc-100 pb-2 last:border-0">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="leading-snug">{a.body}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDayEs(a.createdAt, "d MMM yyyy")} · {a.user?.name ?? "Sistema"}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
