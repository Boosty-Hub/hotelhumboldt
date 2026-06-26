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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ThumbsUp,
  ThumbsDown,
  FileSignature,
  CopyPlus,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { changeQuoteStatus, createNewVersion } from "@/app/(app)/cotizaciones/actions";

interface Props {
  quoteId: string;
  status: string;
  /** Si hay cambios sin guardar, se pide guardar antes de cambiar estado. */
  hasUnsavedChanges?: boolean;
}

type PendingAction =
  | { kind: "APROBADA" }
  | { kind: "RECHAZADA" }
  | { kind: "CONTRATADA" }
  | { kind: "VERSION" };

const CONFIRM_COPY: Record<string, { title: string; description: string; cta: string }> = {
  APROBADA: {
    title: "Registrar aprobación del cliente",
    description:
      "Usa esta opción si el cliente confirmó por teléfono o correo. Puedes indicar quién aprobó.",
    cta: "Registrar aprobación",
  },
  RECHAZADA: {
    title: "Registrar rechazo",
    description: "Indica el motivo del rechazo para dejar trazabilidad en la oportunidad.",
    cta: "Registrar rechazo",
  },
  CONTRATADA: {
    title: "¿Contratar este evento?",
    description:
      "La oportunidad pasará a Ganado y se crearán reservas tentativas de salones para las fechas del evento. Esta acción confirma el negocio.",
    cta: "Contratar",
  },
  VERSION: {
    title: "Crear nueva versión",
    description:
      "Se clonará la cotización completa (mismas líneas) como un nuevo borrador editable. Esta versión quedará como histórico.",
    cta: "Crear versión",
  },
};

export function StatusActions({ quoteId, status, hasUnsavedChanges }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [note, setNote] = useState("");

  function open(action: PendingAction) {
    if (hasUnsavedChanges) {
      toast.warning("Guarda los cambios antes de cambiar el estado de la cotización.");
      return;
    }
    setNote("");
    setPending(action);
  }

  function execute() {
    if (!pending) return;
    const action = pending;
    startTransition(async () => {
      if (action.kind === "VERSION") {
        const res = await createNewVersion(quoteId);
        // Si retorna, hubo error (en éxito redirige al nuevo editor)
        if (res && !res.ok) toast.error(res.error);
        return;
      }
      if (action.kind === "RECHAZADA" && note.trim().length < 3) {
        toast.error("Indica el motivo del rechazo");
        return;
      }
      const res = await changeQuoteStatus(quoteId, action.kind, note.trim() || undefined);
      if (res.ok) {
        const messages: Record<string, string> = {
          APROBADA: "Aprobación registrada",
          RECHAZADA: "Rechazo registrado",
          CONTRATADA: "¡Evento contratado! La oportunidad pasó a Ganado.",
        };
        toast.success(messages[action.kind] ?? "Estado actualizado");
        setPending(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const canDecide = status === "ENVIADA" || status === "VENCIDA";
  const canContract = status === "ENVIADA" || status === "APROBADA";

  const primary = canContract ? (
    <Button size="default" onClick={() => open({ kind: "CONTRATADA" })} disabled={isPending}>
      <FileSignature className="h-3.5 w-3.5" />
      Contratar
    </Button>
  ) : null;

  const copy = pending ? CONFIRM_COPY[pending.kind] : null;

  return (
    <>
      <div className="flex items-center gap-2">
        {primary}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Acciones
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canDecide && (
              <>
                <DropdownMenuItem onClick={() => open({ kind: "APROBADA" })}>
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Cliente aprobó (manual)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => open({ kind: "RECHAZADA" })}>
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Cliente rechazó (manual)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => open({ kind: "VERSION" })}>
              <CopyPlus className="h-3.5 w-3.5" />
              Nueva versión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          {copy && (
            <>
              <DialogHeader>
                <DialogTitle>{copy.title}</DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>
              {pending?.kind === "APROBADA" && (
                <div className="space-y-1.5">
                  <Label htmlFor="approved-by">¿Quién aprobó? (opcional)</Label>
                  <Input
                    id="approved-by"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Nombre del contacto que aprobó"
                  />
                </div>
              )}
              {pending?.kind === "RECHAZADA" && (
                <div className="space-y-1.5">
                  <Label htmlFor="reject-note">Motivo del rechazo</Label>
                  <Textarea
                    id="reject-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ej.: precio fuera de presupuesto, fecha no disponible…"
                    rows={3}
                  />
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPending(null)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button onClick={execute} disabled={isPending}>
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {copy.cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
