"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  CircleCheck,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
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
import {
  ClientFormDialog,
  type ClientFormData,
} from "../../_components/client-form-dialog";
import { deleteClientAction, setClientActiveAction } from "../../actions";

export function ClientActions({
  client,
  active,
  opportunityCount,
}: {
  client: ClientFormData;
  active: boolean;
  opportunityCount: number;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"desactivar" | "eliminar" | null>(null);
  const [pending, startTransition] = useTransition();

  function handleToggleActive() {
    startTransition(async () => {
      const res = await setClientActiveAction(client.id, !active);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(active ? "Cliente desactivado" : "Cliente reactivado");
      setConfirm(null);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteClientAction(client.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Cliente eliminado");
      setConfirm(null);
      router.push("/clientes");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <ClientFormDialog client={client}>
        <Button variant="outline">
          <Pencil data-icon="inline-start" />
          Editar
        </Button>
      </ClientFormDialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Más acciones">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {active ? (
            <DropdownMenuItem onSelect={() => setConfirm("desactivar")}>
              <Ban className="h-3.5 w-3.5" />
              Desactivar cliente
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={handleToggleActive}>
              <CircleCheck className="h-3.5 w-3.5" />
              Reactivar cliente
            </DropdownMenuItem>
          )}
          {opportunityCount === 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirm("eliminar")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar cliente
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmación: desactivar */}
      <AlertDialog
        open={confirm === "desactivar"}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              «{client.legalName}» dejará de aparecer en los listados activos,
              pero conservará todo su historial de oportunidades, cotizaciones y
              notas. Podrás reactivarlo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleToggleActive();
              }}
              disabled={pending}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación: eliminar (solo sin oportunidades) */}
      <AlertDialog
        open={confirm === "eliminar"}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{client.legalName}» junto con sus contactos y notas.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
