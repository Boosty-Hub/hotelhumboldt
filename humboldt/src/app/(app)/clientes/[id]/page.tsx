import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { formatDayEs } from "@/lib/dates";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Bot,
  CalendarCheck2,
  CalendarClock,
  FileText,
  History,
  KanbanSquare,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  Phone,
  StickyNote,
  TrendingUp,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fmtUsd } from "@/lib/money";
import {
  STAGE_COLORS,
  STAGE_LABELS,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  type Stage,
  type QuoteStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientTypeBadge } from "../_components/client-type-badge";
import { ClientFormDialog } from "../_components/client-form-dialog";
import { EmptyState } from "../_components/empty-state";
import { ClientActions } from "./_components/client-actions";
import { ContactsCard } from "./_components/contacts-card";
import { NoteComposer } from "./_components/note-composer";
import { ACTIVITY_TYPE_LABELS, initials } from "../_lib/shared";

export const metadata = { title: "Cliente — Hotel Humboldt" };

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  NOTA: StickyNote,
  LLAMADA: Phone,
  EMAIL: Mail,
  REUNION: Users,
  DEGUSTACION: UtensilsCrossed,
  CAMBIO_ETAPA: ArrowRightLeft,
  SISTEMA: Bot,
};

function StageBadge({ stage }: { stage: string }) {
  const known = stage in STAGE_LABELS;
  return (
    <Badge
      variant="outline"
      className={cn(known && STAGE_COLORS[stage as Stage])}
    >
      {known ? STAGE_LABELS[stage as Stage] : stage}
    </Badge>
  );
}

function QuoteStatusBadge({ status }: { status: string }) {
  const known = status in QUOTE_STATUS_LABELS;
  return (
    <Badge
      variant="outline"
      className={cn(known && QUOTE_STATUS_COLORS[status as QuoteStatus])}
    >
      {known ? QUOTE_STATUS_LABELS[status as QuoteStatus] : status}
    </Badge>
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
  href,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const card = (
    <Card
      size="sm"
      className={cn(
        href &&
          "h-full cursor-pointer transition-shadow hover:ring-foreground/25"
      )}
    >
      <CardContent className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            iconClass
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="truncate text-base font-bold tabular-nums">{value}</p>
          {hint ? (
            <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {href ? (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : null}
      </CardContent>
    </Card>
  );
  if (!href) return card;
  return (
    <Link href={href} scroll={false} className="block focus-visible:outline-none">
      {card}
    </Link>
  );
}

function fmtDate(d: Date | null | undefined, pattern = "d MMM yyyy"): string {
  if (!d) return "—";
  return format(d, pattern, { locale: es });
}

export default async function ClienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      opportunities: {
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { name: true } } },
      },
      clientNotes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });

  if (!client) notFound();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [quotes, activities, eventsDone, nextEvent] = await Promise.all([
    prisma.quote.findMany({
      where: { opportunity: { clientId: id } },
      orderBy: { issueDate: "desc" },
      include: { opportunity: { select: { code: true, title: true } } },
    }),
    prisma.activity.findMany({
      where: {
        OR: [{ clientId: id }, { opportunity: { clientId: id } }],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true } },
        opportunity: { select: { code: true, title: true } },
      },
    }),
    prisma.event.count({
      where: { opportunity: { clientId: id }, status: "EJECUTADO" },
    }),
    prisma.event.findFirst({
      where: {
        opportunity: { clientId: id },
        status: { not: "CANCELADO" },
        startDate: { gte: startOfToday },
      },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const wonRevenue = client.opportunities
    .filter((o) => o.stage === "GANADO")
    .reduce((sum, o) => sum + o.estimatedValue, 0);

  // Próximo evento: primero eventos reales; si no hay, próxima fecha esperada
  const nextOppDate = client.opportunities
    .filter(
      (o) =>
        o.stage !== "PERDIDO" &&
        o.expectedEventDate &&
        o.expectedEventDate >= startOfToday
    )
    .sort(
      (a, b) =>
        (a.expectedEventDate?.getTime() ?? 0) -
        (b.expectedEventDate?.getTime() ?? 0)
    )[0];

  const nextEventDate = nextEvent?.startDate ?? nextOppDate?.expectedEventDate ?? null;
  const nextEventName = nextEvent?.name ?? nextOppDate?.title ?? undefined;

  const validTabs = ["resumen", "oportunidades", "cotizaciones", "notas", "actividad"];
  const activeTab =
    typeof sp.tab === "string" && validTabs.includes(sp.tab) ? sp.tab : "resumen";

  const clientFormData = {
    id: client.id,
    legalName: client.legalName,
    brandName: client.brandName,
    rif: client.rif,
    type: client.type,
    address: client.address,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
  };

  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: "Razón social", value: client.legalName },
    { label: "Marca comercial", value: client.brandName ?? "—" },
    {
      label: "RIF",
      value: client.rif ? (
        <span className="font-mono">{client.rif}</span>
      ) : (
        "—"
      ),
    },
    { label: "Tipo", value: <ClientTypeBadge type={client.type} /> },
    {
      label: "Teléfono",
      value: client.phone ? (
        <span className="inline-flex items-center gap-1.5">
          <Phone className="h-3 w-3 text-muted-foreground" />
          {client.phone}
        </span>
      ) : (
        "—"
      ),
    },
    {
      label: "Correo",
      value: client.email ? (
        <span className="inline-flex items-center gap-1.5">
          <Mail className="h-3 w-3 text-muted-foreground" />
          {client.email}
        </span>
      ) : (
        "—"
      ),
    },
    {
      label: "Dirección",
      value: client.address ? (
        <span className="inline-flex items-start gap-1.5">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          {client.address}
        </span>
      ) : (
        "—"
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Volver */}
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Clientes
      </Link>

      {/* Encabezado de perfil */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-sky-950 text-xl font-semibold text-white">
              {initials(client.brandName || client.legalName)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {client.legalName}
              </h1>
              {!client.active ? (
                <Badge
                  variant="outline"
                  className="bg-rose-50 text-rose-700 border-rose-200"
                >
                  Inactivo
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {client.brandName ? (
                <p className="text-sm text-muted-foreground">
                  {client.brandName}
                </p>
              ) : null}
              <ClientTypeBadge type={client.type} />
              {client.rif ? (
                <Badge variant="outline" className="font-mono">
                  {client.rif}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Cliente desde {fmtDate(client.createdAt, "MMMM 'de' yyyy")}
            </p>
          </div>
        </div>
        <ClientActions
          client={clientFormData}
          active={client.active}
          opportunityCount={client.opportunities.length}
        />
      </div>

      {/* Estadísticas */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          iconClass="bg-emerald-50 text-emerald-600"
          label="Revenue ganado"
          value={fmtUsd(wonRevenue)}
        />
        <StatCard
          icon={CalendarCheck2}
          iconClass="bg-sky-50 text-sky-600"
          label="Eventos realizados"
          value={String(eventsDone)}
          hint={`${client.opportunities.length} evento${client.opportunities.length === 1 ? "" : "s"} en total`}
          href={`/clientes/${client.id}?tab=oportunidades`}
        />
        <StatCard
          icon={FileText}
          iconClass="bg-violet-50 text-violet-600"
          label="Cotizaciones"
          value={String(quotes.length)}
          href={`/clientes/${client.id}?tab=cotizaciones`}
        />
        <StatCard
          icon={CalendarClock}
          iconClass="bg-amber-50 text-amber-600"
          label="Próximo evento"
          value={nextEventDate ? formatDayEs(nextEventDate, "d MMM yyyy") : "—"}
          hint={nextEventName}
        />
      </div>

      {/* Pestañas */}
      <Tabs defaultValue={activeTab} key={activeTab}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="oportunidades">
            Oportunidades
            <Badge variant="secondary">{client.opportunities.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="cotizaciones">
            Cotizaciones
            <Badge variant="secondary">{quotes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="notas">
            Notas
            <Badge variant="secondary">{client.clientNotes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="actividad">Actividad</TabsTrigger>
        </TabsList>

        {/* ── Resumen ── */}
        <TabsContent value="resumen" className="mt-2">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Datos del cliente</CardTitle>
                <CardDescription>Información fiscal y de contacto</CardDescription>
                <CardAction>
                  <ClientActionsEditSlot client={clientFormData} />
                </CardAction>
              </CardHeader>
              <CardContent>
                <dl className="divide-y">
                  {infoRows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-3 gap-2 py-2 first:pt-0 last:pb-0"
                    >
                      <dt className="text-xs text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd className="col-span-2 text-xs font-medium">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {client.notes ? (
                  <div className="mt-4 rounded-md border bg-amber-50/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                      Notas internas
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-amber-900">
                      {client.notes}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <ContactsCard clientId={client.id} contacts={client.contacts} />
          </div>
        </TabsContent>

        {/* ── Oportunidades ── */}
        <TabsContent value="oportunidades" className="mt-2">
          {client.opportunities.length === 0 ? (
            <EmptyState
              icon={KanbanSquare}
              title="Sin oportunidades"
              description="Este cliente aún no tiene oportunidades de eventos. Créalas desde el pipeline."
            >
              <Button variant="outline" asChild>
                <Link href="/pipeline">
                  Ir al pipeline
                  <ArrowUpRight data-icon="inline-end" />
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Fecha del evento</TableHead>
                    <TableHead>Ejecutivo</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.opportunities.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">
                        {o.code}
                      </TableCell>
                      <TableCell className="max-w-64">
                        <p className="truncate text-sm font-medium">{o.title}</p>
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={o.stage} />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {fmtUsd(o.estimatedValue)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.expectedEventDate ? formatDayEs(o.expectedEventDate, "d MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.owner.name}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link
                            href={`/pipeline?op=${o.id}`}
                            aria-label={`Ver ${o.code} en el pipeline`}
                          >
                            <ArrowUpRight />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ── Cotizaciones ── */}
        <TabsContent value="cotizaciones" className="mt-2">
          {quotes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Sin cotizaciones"
              description="Las cotizaciones de las oportunidades de este cliente aparecerán aquí."
            />
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Oportunidad</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((qt) => (
                    <TableRow key={qt.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/cotizaciones/${qt.id}`}
                          className="hover:underline"
                        >
                          {qt.number}
                        </Link>
                        {qt.version > 1 ? (
                          <span className="ml-1 text-muted-foreground">
                            v{qt.version}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-64">
                        <p className="truncate text-xs">
                          <span className="font-mono text-muted-foreground">
                            {qt.opportunity.code}
                          </span>{" "}
                          · {qt.opportunity.title}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(qt.issueDate)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {fmtUsd(qt.totalUsd)}
                      </TableCell>
                      <TableCell>
                        <QuoteStatusBadge status={qt.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ── Notas ── */}
        <TabsContent value="notas" className="mt-2">
          <Card>
            <CardContent className="space-y-5">
              <NoteComposer
                clientId={client.id}
                userName={session?.user?.name ?? "Usuario"}
              />
              {client.clientNotes.length === 0 ? (
                <EmptyState
                  icon={MessageSquareText}
                  title="Sin notas todavía"
                  description="Deja la primera nota: acuerdos, preferencias del cliente o pendientes de seguimiento."
                />
              ) : (
                <ul className="space-y-4">
                  {client.clientNotes.map((note) => (
                    <li key={note.id} className="flex items-start gap-3">
                      <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-muted text-[10px] font-semibold">
                          {initials(note.author.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 rounded-lg border bg-muted/30 px-3 py-2">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <p className="text-xs font-semibold">
                            {note.author.name}
                          </p>
                          <p
                            className="text-[11px] text-muted-foreground"
                            title={fmtDate(note.createdAt, "d MMM yyyy · HH:mm")}
                          >
                            {formatDistanceToNow(note.createdAt, {
                              addSuffix: true,
                              locale: es,
                            })}
                          </p>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs">
                          {note.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Actividad ── */}
        <TabsContent value="actividad" className="mt-2">
          <Card>
            <CardContent>
              {activities.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="Sin actividad registrada"
                  description="Las interacciones con este cliente y sus oportunidades aparecerán aquí en orden cronológico."
                />
              ) : (
                <ol className="relative space-y-5 before:absolute before:inset-y-1 before:left-[15px] before:w-px before:bg-border">
                  {activities.map((a) => {
                    const Icon = ACTIVITY_ICONS[a.type] ?? StickyNote;
                    return (
                      <li key={a.id} className="relative flex items-start gap-3">
                        <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className="text-xs font-semibold">{a.user.name}</p>
                            <Badge variant="outline">
                              {ACTIVITY_TYPE_LABELS[a.type] ?? a.type}
                            </Badge>
                            {a.opportunity ? (
                              <Link
                                href={`/pipeline?op=${a.opportunityId}`}
                                className="font-mono text-[11px] text-sky-700 hover:underline"
                              >
                                {a.opportunity.code}
                              </Link>
                            ) : null}
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-xs">
                            {a.body}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {fmtDate(a.createdAt, "d MMM yyyy · HH:mm")}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Botón "Editar" del card de datos (reutiliza el dialog compartido)
function ClientActionsEditSlot({
  client,
}: {
  client: React.ComponentProps<typeof ClientFormDialog>["client"];
}) {
  return (
    <ClientFormDialog client={client}>
      <Button variant="ghost" size="sm">
        <Pencil data-icon="inline-start" />
        Editar
      </Button>
    </ClientFormDialog>
  );
}
