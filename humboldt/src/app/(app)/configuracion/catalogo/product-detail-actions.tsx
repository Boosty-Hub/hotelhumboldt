"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { deleteProduct, toggleProductActive } from "./actions";
import { ProductDialog } from "./product-dialog";
import type { CategoryOption, ProductRow, SupplierOption } from "./catalog-shared";

export function ProductDetailActions({
  product,
  categories,
  suppliers,
  showCosts,
}: {
  product: ProductRow;
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  showCosts: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const res = await toggleProductActive(product.id, !product.active);
      if (res.ok) {
        toast.success(product.active ? "Producto desactivado" : "Producto activado");
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      const res = await deleteProduct(product.id);
      if (res.ok) {
        toast.success(`Producto «${product.name}» eliminado`);
        router.push("/configuracion/catalogo");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button onClick={() => setEditOpen(true)} disabled={pending}>
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Más acciones">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleToggle}>
            <Power className="h-3.5 w-3.5" />
            {product.active ? "Desactivar" : "Activar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProductDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={product}
        categories={categories}
        suppliers={suppliers}
        showCosts={showCosts}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{product.name}» y todo su historial de precios. Esta acción
              no se puede deshacer.
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
    </div>
  );
}
