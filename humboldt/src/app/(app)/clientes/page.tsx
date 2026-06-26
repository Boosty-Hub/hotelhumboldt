import Link from "next/link";
import { ChevronRight, Plus, Users, SearchX } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateTimeFilter, parseDateRange } from "@/lib/list-query";
import { fmtUsd } from "@/lib/money";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ClientsToolbar } from "./_components/clients-toolbar";
import { ClientFormDialog } from "./_components/client-form-dialog";
import { ClientTypeBadge } from "./_components/client-type-badge";
import { EmptyState } from "./_components/empty-state";
import { initials } from "./_lib/shared";

export const metadata = { title: "Clientes — Hotel Humboldt" };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const orden: "nombre" | "revenue" = sp.orden === "revenue" ? "revenue" : "nombre";
  const showInactive = sp.inactivos === "1";
  const range = parseDateRange(sp);

  const where: Prisma.ClientWhereInput = {};
  if (!showInactive) where.active = true;
  // El rango desde–hasta filtra por la fecha de registro del cliente.
  const createdAt = dateTimeFilter(range);
  if (createdAt) where.createdAt = createdAt;

  const [clients, totalClients] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        contacts: { orderBy: { isPrimary: "desc" }, take: 1 },
        opportunities: {
          select: { stage: true, estimatedValue: true, title: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.client.count(),
  ]);

  // Búsqueda en memoria (insensible a acentos): PostgreSQL `mode:"insensitive"`
  // ignora mayúsculas pero NO acentos; con normalize() igualamos "á"≈"a". El
  // catálogo de clientes es chico, así que filtrar en memoria es barato.
  const nq = normalize(q);
  const rows = clients
    .map((c) => ({
      ...c,
      primaryContact: c.contacts[0] ?? null,
      oppCount: c.opportunities.length,
      latestEvent: c.opportunities[0]?.title ?? null,
      wonRevenue: c.opportunities
        .filter((o) => o.stage === "GANADO")
        .reduce((sum, o) => sum + o.estimatedValue, 0),
    }))
    .filter(
      (c) =>
        !nq ||
        normalize(c.legalName).includes(nq) ||
        normalize(c.brandName ?? "").includes(nq) ||
        normalize(c.rif ?? "").includes(nq)
    )
    .sort((a, b) =>
      orden === "revenue"
        ? b.wonRevenue - a.wonRevenue ||
          a.legalName.localeCompare(b.legalName, "es")
        : a.legalName.localeCompare(b.legalName, "es")
    );

  const newClientButton = (
    <ClientFormDialog>
      <Button>
        <Plus data-icon="inline-start" />
        Nuevo cliente
      </Button>
    </ClientFormDialog>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length === 1
              ? "1 cliente registrado"
              : `${rows.length} clientes registrados`}
            {q ? ` para «${q}»` : ""}
          </p>
        </div>
        {newClientButton}
      </div>

      <ClientsToolbar orden={orden} showInactive={showInactive} />

      {totalClients === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay clientes"
          description="Registrá tu primer cliente para empezar a crear oportunidades y cotizaciones de eventos."
        >
          {newClientButton}
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={q ? `Sin resultados para «${q}»` : "Sin resultados"}
          description="Probá con otra búsqueda, otro rango de fechas, o limpiá los filtros."
        >
          <Button variant="outline" asChild>
            <Link href="/clientes">Limpiar filtros</Link>
          </Button>
        </EmptyState>
      ) : (
        <Card className="py-0">
          <Table containerClassName="max-h-[70vh] overflow-y-auto">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>RIF</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contacto principal</TableHead>
                <TableHead className="text-center">Oportunidades</TableHead>
                <TableHead className="text-right">Revenue ganado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow
                  key={c.id}
                  className={cn(!c.active && "opacity-60")}
                >
                  <TableCell className="max-w-[16rem]">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="group flex items-center gap-3"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-sky-950 text-[10px] font-semibold text-white">
                          {initials(c.brandName || c.legalName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium group-hover:underline">
                          {c.legalName}
                          {!c.active ? (
                            <Badge
                              variant="outline"
                              className="ml-2 bg-rose-50 text-rose-700 border-rose-200"
                            >
                              Inactivo
                            </Badge>
                          ) : null}
                        </p>
                        {c.brandName ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {c.brandName}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[14rem]">
                    {c.latestEvent ? (
                      <div className="min-w-0">
                        <p className="truncate text-sm">{c.latestEvent}</p>
                        {c.oppCount > 1 ? (
                          <p className="text-xs text-muted-foreground">
                            +{c.oppCount - 1} evento{c.oppCount - 1 === 1 ? "" : "s"} más
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.rif ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ClientTypeBadge type={c.type} />
                  </TableCell>
                  <TableCell className="max-w-[12rem]">
                    {c.primaryContact ? (
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {c.primaryContact.name}
                        </p>
                        {c.primaryContact.phone || c.primaryContact.email ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {c.primaryContact.phone ?? c.primaryContact.email}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {c.oppCount}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {c.wonRevenue > 0 ? (
                      <span className="text-emerald-700">
                        {fmtUsd(c.wonRevenue)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" asChild>
                      <Link
                        href={`/clientes/${c.id}`}
                        aria-label={`Ver ${c.legalName}`}
                      >
                        <ChevronRight />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
