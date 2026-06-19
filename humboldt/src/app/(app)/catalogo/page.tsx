import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, canViewCosts } from "@/lib/auth";
import { getCommercialParams } from "@/lib/settings";
import { PRODUCT_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CatalogHeaderActions } from "./catalog-header-actions";
import { CatalogToolbar } from "./catalog-toolbar";
import { ProductsTable } from "./products-table";

export const metadata = { title: "Catálogo" };

const PAGE_SIZE = 50;

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, sp] = await Promise.all([auth(), searchParams]);
  const showCosts = canViewCosts(session?.user?.role);
  const { minMarginPct } = await getCommercialParams();

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const categoria = typeof sp.categoria === "string" ? sp.categoria : "";
  const tipo =
    typeof sp.tipo === "string" && (PRODUCT_TYPES as readonly string[]).includes(sp.tipo)
      ? sp.tipo
      : "";
  const inactivos = sp.inactivos === "1";
  const paginaRaw = typeof sp.pagina === "string" ? parseInt(sp.pagina, 10) : 1;
  const hasFilters = !!(q || categoria || tipo || inactivos);

  const where: Prisma.ProductWhereInput = {
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(categoria
      ? categoria === "SIN_CATEGORIA"
        ? { categoryId: null }
        : { categoryId: categoria }
      : {}),
    ...(tipo ? { type: tipo } : {}),
    ...(inactivos ? {} : { active: true }),
  };

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagina = Math.min(
    Math.max(Number.isNaN(paginaRaw) ? 1 : paginaRaw, 1),
    totalPages
  );

  const [products, categoryRows, suppliers] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      skip: (pagina - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    }),
    prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Seguridad: NUNCA serializar costo/proveedor al cliente si no tiene permiso
  // (el ocultado visual no basta — el campo viajaría en el payload RSC).
  const safeProducts = showCosts
    ? products
    : products.map((p) => ({ ...p, cost: null, supplierId: null }));

  const categories = categoryRows.map((c) => ({ id: c.id, name: c.name }));
  const categoryItems = categoryRows.map((c) => ({
    id: c.id,
    name: c.name,
    sortOrder: c.sortOrder,
    productCount: c._count.products,
  }));

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categoria) params.set("categoria", categoria);
    if (tipo) params.set("tipo", tipo);
    if (inactivos) params.set("inactivos", "1");
    if (p > 1) params.set("pagina", String(p));
    const qs = params.toString();
    return qs ? `/catalogo?${qs}` : "/catalogo";
  };

  const desde = total === 0 ? 0 : (pagina - 1) * PAGE_SIZE + 1;
  const hasta = Math.min(pagina * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            Productos y servicios para cotizar eventos · {total}{" "}
            {total === 1 ? "resultado" : "resultados"}
          </p>
        </div>
        <CatalogHeaderActions
          categories={categories}
          categoryRows={categoryItems}
          suppliers={suppliers}
          showCosts={showCosts}
        />
      </div>

      <CatalogToolbar
        categories={categories}
        filters={{ q, categoria, tipo, inactivos }}
      />

      <ProductsTable
        products={safeProducts}
        categories={categories}
        suppliers={suppliers}
        showCosts={showCosts}
        hasFilters={hasFilters}
        minMarginPct={minMarginPct}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Mostrando {desde}–{hasta} de {total}
          </p>
          <div className="flex items-center gap-1">
            {pagina > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildHref(pagina - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </Button>
            )}
            <span className="px-2 text-xs text-muted-foreground">
              Página {pagina} de {totalPages}
            </span>
            {pagina < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildHref(pagina + 1)}>
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
