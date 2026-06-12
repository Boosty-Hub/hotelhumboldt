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
import { deleteSupplier, toggleSupplierActive } from "./actions";
import { SupplierDialog } from "./supplier-dialog";
import type { SupplierRow } from "./supplier-shared";

export function SupplierDetailActions({ supplier }: { supplier: SupplierRow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const res = await toggleSupplierActive(supplier.id, !supplier.active);
      if (res.ok) {
        toast.success(supplier.active ? "Proveedor desactivado" : "Proveedor activado");
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      const res = await deleteSupplier(supplier.id);
      if (res.ok) {
        toast.success(`Proveedor «${supplier.name}» eliminado`);
        router.push("/proveedores");
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
            {supplier.active ? "Desactivar" : "Activar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SupplierDialog open={editOpen} onOpenChange={setEditOpen} supplier={supplier} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{supplier.name}». Si tiene productos, cotizaciones o costos
              de evento asociados, no podrá eliminarse: desactívelo.
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
