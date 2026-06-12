"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/money";
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
  MoreHorizontal,
  Package,
  Pencil,
  Percent,
  Plus,
  Power,
  Trash2,
  Truck,
} from "lucide-react";
import { deleteSupplier, toggleSupplierActive } from "./actions";
import { SupplierDialog } from "./supplier-dialog";
import type { SupplierRow } from "./supplier-shared";

export function SuppliersGrid({ suppliers }: { suppliers: SupplierRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [deleting, setDeleting] = useState<SupplierRow | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (s: SupplierRow) => {
    startTransition(async () => {
      const res = await toggleSupplierActive(s.id, !s.active);
      if (res.ok) toast.success(s.active ? "Proveedor desactivado" : "Proveedor activado");
      else toast.error(res.error);
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const res = await deleteSupplier(target.id);
      if (res.ok) toast.success(`Proveedor «${target.name}» eliminado`);
      else toast.error(res.error);
    });
  };

  if (suppliers.length === 0) {
    return (
      <>
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Truck className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Sin proveedores registrados</p>
            <p className="text-xs text-muted-foreground">
              Registre los proveedores de catering, vinos, audiovisuales y demás
              servicios del hotel.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo proveedor
          </Button>
        </Card>
        <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplier={editing} />
      </>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {suppliers.map((s) => (
          <Card
            key={s.id}
            size="sm"
            onClick={() => router.push(`/proveedores/${s.id}`)}
            className={cn(
              "cursor-pointer transition-shadow hover:shadow-md",
              !s.active && "opacity-60"
            )}
          >
            <CardHeader>
              <CardTitle className="truncate" title={s.name}>
                {s.name}
              </CardTitle>
              <CardDescription className="truncate">
                {s.serviceType || "Sin tipo de servicio"}
              </CardDescription>
              <CardAction onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(s);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggle(s)}>
                      <Power className="h-3.5 w-3.5" />
                      {s.active ? "Desactivar" : "Activar"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="secondary">
                  <Package className="h-2.5 w-2.5" />
                  {s.productCount} {s.productCount === 1 ? "producto" : "productos"}
                </Badge>
                {s.appliesIva && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-700"
                  >
                    +IVA
                  </Badge>
                )}
                {s.discountPct != null && s.discountPct > 0 && (
                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-emerald-50 text-emerald-700"
                  >
                    <Percent className="h-2.5 w-2.5" />
                    {fmtPct(s.discountPct)} dcto
                  </Badge>
                )}
                {!s.active && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Inactivo
                  </Badge>
                )}
              </div>
              {s.conditions ? (
                <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {s.conditions}
                </p>
              ) : (
                <p className="text-[11px] italic text-muted-foreground/60">
                  Sin condiciones registradas
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        supplier={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleting?.name}». Si tiene productos, cotizaciones o costos
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
    </>
  );
}
