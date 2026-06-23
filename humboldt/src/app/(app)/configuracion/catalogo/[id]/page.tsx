import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
import { ArrowLeft, History } from "lucide-react";
import {
  calcMarginPct,
  MIN_MARGIN_WARN_PCT,
  PRICE_CONTEXT_LABELS,
  PRODUCT_TYPE_COLORS,
  PRODUCT_TYPE_SHORT_LABELS,
  unitLabel,
  type PriceContext,
} from "../catalog-shared";
import { ProductDetailActions } from "../product-detail-actions";

export const metadata = { title: "Detalle de producto" };

export default async function ProductoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const showCosts = canViewCosts(session?.user?.role);

  const [product, categoryRows, suppliers] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        priceHistory: {
          orderBy: { validFrom: "desc" },
          include: { author: { select: { name: true } } },
        },
        _count: { select: { quoteLines: true } },
      },
    }),
    prisma.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  const margin = calcMarginPct(product.listPrice, product.cost);

  return (
    <div className="space-y-4">
      <Link
        href="/configuracion/catalogo"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al catálogo
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <Badge variant="outline" className={PRODUCT_TYPE_COLORS[product.type] ?? ""}>
              {PRODUCT_TYPE_SHORT_LABELS[product.type] ?? product.type}
            </Badge>
            {!product.active && (
              <Badge variant="outline" className="text-muted-foreground">
                Inactivo
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {product.category?.name ?? "Sin categoría"} · {unitLabel(product.unit)}
          </p>
        </div>
        <ProductDetailActions
          product={{
            id: product.id,
            name: product.name,
            categoryId: product.categoryId,
            type: product.type,
            unit: product.unit,
            listPrice: product.listPrice,
            // Seguridad: no serializar costo/proveedor al cliente sin permiso
            cost: showCosts ? product.cost : null,
            supplierId: showCosts ? product.supplierId : null,
            minPax: product.minPax,
            unitsPerPax: product.unitsPerPax,
            priceContext: product.priceContext,
            notes: product.notes,
            active: product.active,
            category: product.category,
          }}
          categories={categoryRows}
          suppliers={suppliers}
          showCosts={showCosts}
        />
      </div>

      {/* Tarjetas de precio */}
      <div className={cn("grid gap-4", showCosts ? "md:grid-cols-3" : "md:grid-cols-1 md:max-w-xs")}>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Precio de lista</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {product.listPrice == null ? (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-xs text-amber-700"
                >
                  Precio manual al cotizar
                </Badge>
              ) : (
                fmtUsd(product.listPrice)
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        {showCosts && (
          <Card size="sm">
            <CardHeader>
              <CardDescription>Costo proveedor (interno)</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {product.cost == null ? "—" : fmtUsd(product.cost)}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
        {showCosts && (
          <Card size="sm">
            <CardHeader>
              <CardDescription>Margen bruto (interno)</CardDescription>
              <CardTitle
                className={cn(
                  "text-xl tabular-nums",
                  margin != null &&
                    (margin < MIN_MARGIN_WARN_PCT ? "text-red-600" : "text-emerald-700")
                )}
              >
                {margin == null ? "—" : fmtPct(margin)}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>

      {/* Detalles */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Detalles</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
            <DetailItem label="Categoría" value={product.category?.name ?? "—"} />
            <DetailItem label="Unidad" value={unitLabel(product.unit)} />
            <DetailItem
              label="Contexto de precio"
              value={
                product.priceContext
                  ? PRICE_CONTEXT_LABELS[product.priceContext as PriceContext] ??
                    product.priceContext
                  : "—"
              }
            />
            <DetailItem
              label="Mínimo de pax"
              value={product.minPax != null ? `${product.minPax} pax` : "—"}
            />
            <DetailItem
              label="Unidades por pax"
              value={product.unitsPerPax != null ? `${product.unitsPerPax} und` : "—"}
            />
            {showCosts && (
              <DetailItem
                label="Proveedor"
                value={
                  product.supplier ? (
                    <Link
                      href={`/proveedores/${product.supplier.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      {product.supplier.name}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
            )}
            <DetailItem
              label="Usos en cotizaciones"
              value={`${product._count.quoteLines} línea(s)`}
            />
          </dl>
          {product.notes && (
            <div className="mt-4 rounded-md bg-muted/50 p-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Notas
              </p>
              <p className="whitespace-pre-wrap text-xs">{product.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de precios */}
      <Card size="sm" className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial de precios
          </CardTitle>
          <CardDescription>
            Cada cambio de precio o costo queda registrado con autor y motivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {product.priceHistory.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Sin cambios de precio registrados todavía.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">Fecha</TableHead>
                  <TableHead className="text-right">Precio lista</TableHead>
                  {showCosts && <TableHead className="text-right">Costo</TableHead>}
                  <TableHead>Autor</TableHead>
                  <TableHead className="pr-4">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.priceHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="pl-4 text-muted-foreground">
                      {format(h.validFrom, "dd/MM/yyyy HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {h.listPrice == null ? "—" : fmtUsd(h.listPrice)}
                    </TableCell>
                    {showCosts && (
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {h.cost == null ? "—" : fmtUsd(h.cost)}
                      </TableCell>
                    )}
                    <TableCell>{h.author?.name ?? "Sistema"}</TableCell>
                    <TableCell className="max-w-72 truncate pr-4 text-muted-foreground">
                      {h.reason ?? "—"}
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

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
