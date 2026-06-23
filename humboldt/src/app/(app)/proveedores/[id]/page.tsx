import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, canViewCosts } from "@/lib/auth";
import { fmtPct, fmtUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
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
  CalendarDays,
  FileText,
  Mail,
  Package,
  Phone,
  User,
} from "lucide-react";
import {
  calcMarginPct,
  MIN_MARGIN_WARN_PCT,
  unitLabel,
} from "../../configuracion/catalogo/catalog-shared";
import { SupplierDetailActions } from "../supplier-detail-actions";
import {
  SUPPLIER_COST_STATUS_COLORS,
  SUPPLIER_COST_STATUS_LABELS,
} from "../supplier-shared";

export const metadata = { title: "Detalle de proveedor" };

export default async function ProveedorDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const showCosts = canViewCosts(session?.user?.role);

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      products: {
        include: { category: { select: { name: true } } },
        orderBy: { name: "asc" },
      },
      eventCosts: {
        include: {
          event: {
            select: {
              id: true,
              name: true,
              opportunity: { select: { code: true, title: true } },
            },
          },
        },
      },
      _count: { select: { quoteLines: true } },
    },
  });

  if (!supplier) notFound();

  const row = {
    id: supplier.id,
    name: supplier.name,
    serviceType: supplier.serviceType,
    contactName: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    discountPct: supplier.discountPct,
    appliesIva: supplier.appliesIva,
    conditions: supplier.conditions,
    active: supplier.active,
    productCount: supplier.products.length,
  };

  return (
    <div className="space-y-4">
      <Link
        href="/proveedores"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a proveedores
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
            {supplier.appliesIva && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700"
              >
                +IVA
              </Badge>
            )}
            {supplier.discountPct != null && supplier.discountPct > 0 && (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-50 text-emerald-700"
              >
                {fmtPct(supplier.discountPct)} dcto
              </Badge>
            )}
            {!supplier.active && (
              <Badge variant="outline" className="text-muted-foreground">
                Inactivo
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {supplier.serviceType || "Sin tipo de servicio"}
          </p>
        </div>
        <SupplierDetailActions supplier={row} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Datos de contacto */}
        <Card size="sm">
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <ContactLine
              icon={<User className="h-3.5 w-3.5" />}
              label="Contacto"
              value={supplier.contactName}
            />
            <ContactLine
              icon={<Phone className="h-3.5 w-3.5" />}
              label="Teléfono"
              value={supplier.phone}
            />
            <ContactLine
              icon={<Mail className="h-3.5 w-3.5" />}
              label="Correo"
              value={supplier.email}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="secondary">
                <Package className="h-2.5 w-2.5" />
                {supplier.products.length}{" "}
                {supplier.products.length === 1 ? "producto" : "productos"}
              </Badge>
              <Badge variant="secondary">
                <CalendarDays className="h-2.5 w-2.5" />
                {supplier.eventCosts.length}{" "}
                {supplier.eventCosts.length === 1 ? "costo de evento" : "costos de evento"}
              </Badge>
              <Badge variant="secondary">
                <FileText className="h-2.5 w-2.5" />
                {supplier._count.quoteLines}{" "}
                {supplier._count.quoteLines === 1
                  ? "línea de cotización"
                  : "líneas de cotización"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Condiciones */}
        <Card size="sm">
          <CardHeader>
            <CardTitle>Condiciones comerciales</CardTitle>
          </CardHeader>
          <CardContent>
            {supplier.conditions ? (
              <p className="whitespace-pre-wrap text-xs leading-relaxed">
                {supplier.conditions}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Sin condiciones registradas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Productos asociados */}
      <Card size="sm" className="overflow-hidden">
        <CardHeader>
          <CardTitle>Productos asociados</CardTitle>
          <CardDescription>
            Productos del catálogo suministrados por este proveedor.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {supplier.products.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Este proveedor no tiene productos asociados en el catálogo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Precio lista</TableHead>
                  {showCosts && <TableHead className="text-right">Costo</TableHead>}
                  {showCosts && (
                    <TableHead className="pr-4 text-right">Margen</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.products.map((p) => {
                  const margin = calcMarginPct(p.listPrice, p.cost);
                  return (
                    <TableRow key={p.id} className={cn(!p.active && "opacity-50")}>
                      <TableCell className="max-w-80 pl-4">
                        <Link
                          href={`/configuracion/catalogo/${p.id}`}
                          className="flex items-center gap-1.5 font-medium hover:underline"
                        >
                          <span className="truncate">{p.name}</span>
                          {!p.active && (
                            <Badge variant="outline" className="shrink-0 text-muted-foreground">
                              Inactivo
                            </Badge>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.category?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {unitLabel(p.unit)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {p.listPrice == null ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-700"
                          >
                            Precio manual
                          </Badge>
                        ) : (
                          fmtUsd(p.listPrice)
                        )}
                      </TableCell>
                      {showCosts && (
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {p.cost == null ? "—" : fmtUsd(p.cost)}
                        </TableCell>
                      )}
                      {showCosts && (
                        <TableCell className="pr-4 text-right">
                          {margin == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                margin < MIN_MARGIN_WARN_PCT
                                  ? "text-red-600"
                                  : "text-emerald-700"
                              )}
                            >
                              {fmtPct(margin)}
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Costos por evento */}
      <Card size="sm" className="overflow-hidden">
        <CardHeader>
          <CardTitle>Costos por evento</CardTitle>
          <CardDescription>
            Servicios cotizados o contratados a este proveedor por evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {supplier.eventCosts.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Sin costos de evento registrados para este proveedor.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">Evento</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="pr-4">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.eventCosts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-72 pl-4">
                      <div className="leading-tight">
                        <p className="truncate font-medium">{c.event.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {c.event.opportunity.code} · {c.event.opportunity.title}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">
                      {c.concept}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium tabular-nums">{fmtUsd(c.amount)}</span>
                      {c.plusIva && (
                        <Badge
                          variant="outline"
                          className="ml-1.5 border-amber-300 bg-amber-50 text-amber-700"
                        >
                          +IVA
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <Badge
                        variant="outline"
                        className={SUPPLIER_COST_STATUS_COLORS[c.status] ?? ""}
                      >
                        {SUPPLIER_COST_STATUS_LABELS[c.status] ?? c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContactLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
