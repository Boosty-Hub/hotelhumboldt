"use client";

import { useState } from "react";
import { CircleX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LOST_REASONS } from "@/lib/constants";

export function LostReasonDialog({
  open,
  title,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string | null;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<string>("");

  const handleOpenChange = (next: boolean) => {
    if (!next && !pending) {
      setReason("");
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleX className="size-4 text-rose-600" />
            Marcar como perdida
          </DialogTitle>
          <DialogDescription>
            {title ? (
              <>
                Vas a mover <span className="font-medium text-foreground">«{title}»</span> a la
                etapa Perdido. Indica el motivo para registrarlo en el historial.
              </>
            ) : (
              "Indica el motivo de la pérdida."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="lost-reason">Motivo de la pérdida *</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="lost-reason" className="w-full">
              <SelectValue placeholder="Selecciona un motivo…" />
            </SelectTrigger>
            <SelectContent>
              {LOST_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setReason("");
              onCancel();
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!reason || pending}
            onClick={() => {
              onConfirm(reason);
              setReason("");
            }}
          >
            {pending ? "Guardando…" : "Confirmar pérdida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
