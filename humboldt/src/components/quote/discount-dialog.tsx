"use client";

// REGLA DE ORO del cotizador: todo precio distinto al de lista queda trazado
// con tipo, motivo y autor. Este dialog es OBLIGATORIO: sin motivo, el precio
// vuelve al de lista.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert } from "lucide-react";
import { fmtUsd } from "@/lib/money";
import { DISCOUNT_TYPES, DISCOUNT_TYPE_LABELS, type DiscountType } from "@/lib/constants";
import { priceDeltaPct } from "./quote-utils";

export interface DiscountRequest {
  uid: string;
  description: string;
  listPrice: number;
  newPrice: number;
  currentType: string | null;
  currentReason: string | null;
}

interface Props {
  request: DiscountRequest | null;
  onConfirm: (uid: string, type: DiscountType, reason: string) => void;
  onCancel: (uid: string) => void;
}

export function DiscountDialog({ request, onConfirm, onCancel }: Props) {
  const [type, setType] = useState<DiscountType | "">("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (request) {
      const isDiscount = request.newPrice < request.listPrice;
      setType(
        (request.currentType as DiscountType) ||
          (request.newPrice === 0 ? "CORTESIA" : isDiscount ? "DESCUENTO" : "SOBREPRECIO")
      );
      setReason(request.currentReason ?? "");
      setTouched(false);
    }
  }, [request]);

  if (!request) return null;

  const delta = priceDeltaPct(request.newPrice, request.listPrice);
  const valid = type !== "" && reason.trim().length >= 3;

  function confirm() {
    setTouched(true);
    if (!valid || !request) return;
    onConfirm(request.uid, type as DiscountType, reason.trim());
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel(request.uid)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Precio especial — se requiere motivo
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{request.description}</span>
            <br />
            Precio de lista {fmtUsd(request.listPrice)} → nuevo precio{" "}
            <span className="font-semibold text-foreground">{fmtUsd(request.newPrice)}</span>{" "}
            <span className={delta < 0 ? "text-rose-600" : "text-amber-700"}>
              ({delta > 0 ? "+" : ""}
              {delta}%)
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tipo de ajuste</Label>
            <Select value={type} onValueChange={(v) => setType(v as DiscountType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DISCOUNT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-reason">
              Motivo <span className="text-rose-600">*</span>
            </Label>
            <Textarea
              id="discount-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: cliente corporativo recurrente, negociación cerrada por gerencia…"
              rows={3}
              aria-invalid={touched && !valid}
            />
            {touched && !valid && (
              <p className="text-xs text-rose-600">
                El motivo es obligatorio (mínimo 3 caracteres). Sin motivo, el precio vuelve al de
                lista.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onCancel(request.uid)}>
            Cancelar (volver a lista)
          </Button>
          <Button onClick={confirm}>Aplicar precio especial</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
