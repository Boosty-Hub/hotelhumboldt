"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtPct, round2 } from "@/lib/money";
import { lineMarginPct, lineSubtotal, isPriceOverride } from "@/lib/quote-calc";
import { UNITS, UNIT_LABELS, DISCOUNT_TYPE_LABELS, type DiscountType, type Unit } from "@/lib/constants";
import { MessageSquare, Trash2, CircleDashed } from "lucide-react";
import { priceDeltaPct, type EditorLine } from "./quote-utils";

// ── Input numérico con estado local (permite escribir "1,5" sin pelear) ──
function NumField({
  value,
  onCommit,
  commitOn = "change",
  className,
  min = 0,
  disabled,
  placeholder,
  ariaLabel,
}: {
  value: number | null;
  onCommit: (n: number) => void;
  commitOn?: "change" | "blur";
  className?: string;
  min?: number;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));

  useEffect(() => {
    const parsed = parseFloat(text.replace(",", "."));
    const current = Number.isNaN(parsed) ? null : parsed;
    if (current !== value) setText(value == null ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function parse(t: string): number | null {
    const n = parseFloat(t.replace(",", "."));
    return Number.isNaN(n) ? null : Math.max(n, min);
  }

  return (
    <Input
      inputMode="decimal"
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn("text-right tabular-nums", className)}
      onChange={(e) => {
        setText(e.target.value);
        if (commitOn === "change") {
          const n = parse(e.target.value);
          if (n !== null) onCommit(n);
        }
      }}
      onBlur={() => {
        const n = parse(text);
        if (n === null) {
          setText(value == null ? "" : String(value));
        } else {
          if (n !== value) onCommit(n);
          setText(String(n));
        }
      }}
    />
  );
}

interface Props {
  line: EditorLine;
  canViewCosts: boolean;
  minMarginPct?: number;
  readOnly: boolean;
  onPatch: (uid: string, patch: Partial<EditorLine>) => void;
  onPriceCommit: (uid: string, newPrice: number) => void;
  onEditDiscount: (uid: string) => void;
  onDelete: (uid: string) => void;
}

export function LineRow({
  line,
  canViewCosts,
  minMarginPct = 20,
  readOnly,
  onPatch,
  onPriceCommit,
  onEditDiscount,
  onDelete,
}: Props) {
  const [showComment, setShowComment] = useState(!!line.comment);

  const subtotal = lineSubtotal({
    section: line.section,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    isOptional: line.isOptional,
  });

  const hasOverride =
    line.listPrice != null && isPriceOverride(line.unitPrice, line.listPrice);
  const delta = hasOverride ? priceDeltaPct(line.unitPrice, line.listPrice!) : 0;

  const margin = canViewCosts
    ? lineMarginPct({
        section: line.section,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        isOptional: false, // margen informativo aunque sea opcional
        unitCost: line.unitCost,
        costQuantity: line.costQuantity,
      })
    : null;

  const units: string[] = UNITS.includes(line.unit as Unit)
    ? [...UNITS]
    : [line.unit, ...UNITS];

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card px-3 py-2 transition-colors",
        line.isOptional && "border-dashed bg-muted/40"
      )}
    >
      {/* Fila principal */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1">
          <Input
            value={line.description}
            disabled={readOnly}
            aria-label="Descripción"
            placeholder="Descripción de la línea"
            onChange={(e) => onPatch(line.uid, { description: e.target.value })}
            className={cn(
              "border-transparent bg-transparent px-1 font-medium shadow-none focus-visible:border-input",
              line.isOptional && "italic line-through opacity-60"
            )}
          />
          {/* Badges informativos */}
          {(hasOverride || line.isOptional) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1 px-1">
              {hasOverride && line.discountType && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => !readOnly && onEditDiscount(line.uid)}
                      className="cursor-pointer"
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          delta < 0
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-violet-300 bg-violet-50 text-violet-800"
                        )}
                      >
                        {DISCOUNT_TYPE_LABELS[line.discountType as DiscountType] ??
                          "Precio especial"}{" "}
                        {delta > 0 ? "+" : ""}
                        {delta}%
                      </Badge>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-64">
                    <p className="font-medium">{line.discountReason}</p>
                    {line.discountAuthorName && (
                      <p className="text-[10px] opacity-80">
                        Autorizado por {line.discountAuthorName} · lista{" "}
                        {fmtUsd(line.listPrice)}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              {line.isOptional && (
                <Badge variant="outline" className="border-zinc-300 text-zinc-500">
                  Referencial — no suma
                </Badge>
              )}
            </div>
          )}
        </div>

        <NumField
          value={line.quantity}
          onCommit={(n) => onPatch(line.uid, { quantity: n })}
          className="h-7 w-16"
          disabled={readOnly}
          ariaLabel="Cantidad"
        />

        <Select
          value={line.unit}
          disabled={readOnly}
          onValueChange={(v) => onPatch(line.uid, { unit: v })}
        >
          <SelectTrigger className="h-7 w-24 text-xs" aria-label="Unidad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {units.map((u) => (
              <SelectItem key={u} value={u}>
                {UNIT_LABELS[u as Unit] ?? u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <NumField
          value={line.unitPrice}
          onCommit={(n) => onPriceCommit(line.uid, n)}
          commitOn="blur"
          className={cn("h-7 w-24", hasOverride && "border-amber-400")}
          disabled={readOnly}
          ariaLabel="Precio unitario"
        />

        <div className="w-24 text-right text-sm font-semibold tabular-nums">
          {line.isOptional ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            fmtUsd(subtotal)
          )}
        </div>

        {/* Acciones de la línea — ancho fijo para alinear con el encabezado */}
        <div className="flex w-20 shrink-0 items-center justify-end gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                disabled={readOnly}
                onClick={() => setShowComment((s) => !s)}
                className={cn(line.comment && "text-sky-700")}
                aria-label="Comentario al cliente"
              >
                <MessageSquare className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Comentario al cliente (menú, detalles)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                disabled={readOnly}
                onClick={() => onPatch(line.uid, { isOptional: !line.isOptional })}
                className={cn(line.isOptional && "text-amber-600")}
                aria-label="Marcar como opcional"
              >
                <CircleDashed className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Opcional / referencial: se muestra pero no suma</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            disabled={readOnly}
            onClick={() => onDelete(line.uid)}
            className="text-muted-foreground hover:text-rose-600"
            aria-label="Eliminar línea"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Comentario al cliente */}
      {showComment && (
        <Textarea
          value={line.comment}
          disabled={readOnly}
          onChange={(e) => onPatch(line.uid, { comment: e.target.value })}
          placeholder="Comentario visible para el cliente (ej. detalle del menú, medidas, condiciones)…"
          rows={2}
          className="mt-2 text-xs"
        />
      )}

      {/* Panel interno de costos — SOLO roles con permiso */}
      {canViewCosts && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-zinc-50 px-2 py-1.5 text-[11px] text-muted-foreground dark:bg-zinc-900/50">
          <span className="font-semibold uppercase tracking-wide text-zinc-400">Interno</span>
          <label className="flex items-center gap-1">
            Costo unit.
            <NumField
              value={line.unitCost}
              onCommit={(n) => onPatch(line.uid, { unitCost: n })}
              className="h-6 w-20 text-[11px]"
              disabled={readOnly}
              placeholder="—"
              ariaLabel="Costo unitario"
            />
          </label>
          <label className="flex items-center gap-1">
            Cant. costeo
            <NumField
              value={line.costQuantity}
              onCommit={(n) => onPatch(line.uid, { costQuantity: n })}
              className="h-6 w-16 text-[11px]"
              disabled={readOnly}
              placeholder={String(line.quantity)}
              ariaLabel="Cantidad de costeo"
            />
          </label>
          <span>
            Costo total:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {line.unitCost != null
                ? fmtUsd(round2(line.unitCost * (line.costQuantity ?? line.quantity)))
                : "—"}
            </span>
          </span>
          <span>
            Margen:{" "}
            {margin == null ? (
              <span className="font-medium">—</span>
            ) : (
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  margin < minMarginPct ? "text-rose-600" : "text-emerald-700"
                )}
              >
                {fmtPct(margin)}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/** Encabezado de columnas alineado con LineRow (Descripción · Cant. · Unidad ·
 *  Precio unit. · Subtotal). Se muestra una vez arriba de las líneas. */
export function LineColumnsHeader() {
  return (
    <div className="flex items-center gap-2 px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="min-w-48 flex-1">Descripción</span>
      <span className="w-16 text-right">Cant.</span>
      <span className="w-24">Unidad</span>
      <span className="w-24 text-right">Precio unit.</span>
      <span className="w-24 text-right">Subtotal</span>
      <span className="w-20 shrink-0" aria-hidden />
    </div>
  );
}
