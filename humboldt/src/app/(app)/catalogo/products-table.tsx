"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtPct, fmtUsd } from "@/lib/money";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  History,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { deleteProduct, toggleProductActive } from "./actions";
import { ProductDialog } from "./product-dialog";
import {
  calcMarginPct,
  MIN_MARGIN_WARN_PCT,
  PRODUCT_TYPE_COLORS,
  PRODUCT_TYPE_SHORT_LABELS,
  unitLabel,
  type CategoryOption,
  type ProductRow,
  type SupplierOption,
} from "./catalog-shared";

interface ProductsTableProps {
  products: ProductRow[];
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  showCosts: boolean;
  hasFilters: boolean;
  minMarginPct?: number;
}

export function ProductsTable({
  products,
  categories,
  suppliers,
  showCosts,
  hasFilters,
  minMarginPct = MIN_MARGIN_WARN_PCT,
}: ProductsTableProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const [, startTransition] = useTransition();

  const openEdit = (p: ProductRow) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const handleToggle = (p: ProductRow) => {
    startTransition(async () => {
      const res = await toggleProductActive(p.id, !p.active);
      if (res.ok) {
        toast.success(p.active ? "Producto desactivado" : "Producto activado");
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const res = await deleteProduct(target.id);
      if (res.ok) toast.success(`Producto «${target.name}» eliminado`);
      else toast.error(res.error);
    });
  };

  if (products.length === 0) {
    return (
      <>
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <PackageSearch className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {hasFilters ? "Sin resultados" : "El catálogo está vacío"}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasFilters
                ? "Ningún producto coincide con la búsqueda o los filtros aplicados."
                : "Cree el primer producto para comenzar a cotizar."}
            </p>
          </div>
          {hasFilters ? (
            <Button asChild variant="outline">
              <Link href="/catalogo">Limpiar filtros</Link>
            </Button>
          ) : (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo producto
            </Button>
          )}
        </Card>
        <ProductDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          product={editing}
          categories={categories}
          suppliers={suppliers}
          showCosts={showCosts}
        />
      </>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Precio lista</TableHead>
              {showCosts && <TableHead className="text-right">Costo</TableHead>}
              {showCosts && <TableHead className="text-right">Margen</TableHead>}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const margin = calcMarginPct(p.listPrice, p.cost);
              return (
                <TableRow
                  key={p.id}
                  onClick={() => router.push(`/catalogo/${p.id}`)}
                  className={cn("cursor-pointer", !p.active && "opacity-50")}
                >
                  <TableCell className="max-w-80">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{p.name}</span>
                      {p.minPax != null && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="shrink-0">
                              mín. {p.minPax}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Mínimo {p.minPax} personas para cotizar este producto
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {p.unitsPerPax != null && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="shrink-0">
                              {p.unitsPerPax} und/pax
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Se calculan {p.unitsPerPax} unidades por persona
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {!p.active && (
                        <Badge variant="outline" className="shrink-0 text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.category?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={PRODUCT_TYPE_COLORS[p.type] ?? ""}
                    >
                      {PRODUCT_TYPE_SHORT_LABELS[p.type] ?? p.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{unitLabel(p.unit)}</TableCell>
                  <TableCell className="text-right">
                    {p.listPrice == null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-700"
                          >
                            Precio manual
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          Comodín: el precio se define al momento de cotizar
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="font-medium tabular-nums">{fmtUsd(p.listPrice)}</span>
                    )}
                  </TableCell>
                  {showCosts && (
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {p.cost == null ? "—" : fmtUsd(p.cost)}
                    </TableCell>
                  )}
                  {showCosts && (
                    <TableCell className="text-right">
                      {margin == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            margin < minMarginPct
                              ? "text-red-600"
                              : "text-emerald-700"
                          )}
                        >
                          {fmtPct(margin)}
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/catalogo/${p.id}`)}>
                          <History className="h-3.5 w-3.5" />
                          Ver historial de precios
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggle(p)}>
                          <Power className="h-3.5 w-3.5" />
                          {p.active ? "Desactivar" : "Activar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        product={editing}
        categories={categories}
        suppliers={suppliers}
        showCosts={showCosts}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleting?.name}» y todo su historial de precios. Si el
              producto ya fue usado en cotizaciones, no podrá eliminarse: desactívelo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
