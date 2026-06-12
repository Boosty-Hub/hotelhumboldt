"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { round2 } from "@/lib/money";
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  UNITS,
  UNIT_LABELS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History } from "lucide-react";
import { saveProduct } from "./actions";
import {
  PRICE_CONTEXTS,
  PRICE_CONTEXT_LABELS,
  type CategoryOption,
  type ProductRow,
  type SupplierOption,
} from "./catalog-shared";

const NONE = "__NINGUNO__";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductRow | null; // null = crear
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  showCosts: boolean;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
  suppliers,
  showCosts,
}: ProductDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            {product
              ? "Los cambios de precio o costo quedan registrados en el historial."
              : "Agregue un producto o servicio al catálogo de cotización."}
          </DialogDescription>
        </DialogHeader>
        <ProductForm
          key={product?.id ?? "nuevo"}
          product={product}
          categories={categories}
          suppliers={suppliers}
          showCosts={showCosts}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function numOrNull(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(s: string): number | null {
  const n = numOrNull(s);
  if (n == null) return null;
  return Math.trunc(n);
}

function ProductForm({
  product,
  categories,
  suppliers,
  showCosts,
  onDone,
}: {
  product: ProductRow | null;
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  showCosts: boolean;
  onDone: () => void;
}) {
  const isEditing = !!product;
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [type, setType] = useState(product?.type ?? "PROPIO");
  const [unit, setUnit] = useState(product?.unit ?? "UND");
  const [listPrice, setListPrice] = useState(product?.listPrice?.toString() ?? "");
  const [cost, setCost] = useState(product?.cost?.toString() ?? "");
  const [supplierId, setSupplierId] = useState(product?.supplierId ?? "");
  const [minPax, setMinPax] = useState(product?.minPax?.toString() ?? "");
  const [unitsPerPax, setUnitsPerPax] = useState(product?.unitsPerPax?.toString() ?? "");
  const [priceContext, setPriceContext] = useState(product?.priceContext ?? "");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const r2 = (v: number | null) => (v == null ? null : round2(v));
  const priceChanged = isEditing && r2(product?.listPrice ?? null) !== r2(numOrNull(listPrice));
  const costChanged =
    isEditing && showCosts && r2(product?.cost ?? null) !== r2(numOrNull(cost));
  const requiresReason = priceChanged || costChanged;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveProduct({
        id: product?.id ?? null,
        name,
        categoryId: categoryId || null,
        type,
        unit,
        listPrice: numOrNull(listPrice),
        cost: showCosts ? numOrNull(cost) : null,
        supplierId: showCosts ? supplierId || null : null,
        minPax: intOrNull(minPax),
        unitsPerPax: intOrNull(unitsPerPax),
        priceContext: priceContext || null,
        notes: notes.trim() || null,
        priceChangeReason: reason.trim() || null,
      });
      if (res.ok) {
        toast.success(isEditing ? "Producto actualizado" : "Producto creado");
        onDone();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Nombre *" error={errors.name}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Estación de quesos premium"
          autoFocus
          maxLength={160}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría" error={errors.categoryId}>
          <Select
            value={categoryId || NONE}
            onValueChange={(v) => setCategoryId(v === NONE ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value={NONE}>Sin categoría</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Tipo" error={errors.type}>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {PRODUCT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {PRODUCT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Unidad" error={errors.unit}>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {UNIT_LABELS[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Contexto de precio" error={errors.priceContext}>
          <Select
            value={priceContext || NONE}
            onValueChange={(v) => setPriceContext(v === NONE ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={NONE}>No aplica</SelectItem>
              {PRICE_CONTEXTS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRICE_CONTEXT_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Precio de lista (USD)"
          error={errors.listPrice}
          hint={type === "COMODIN" ? "Comodín: deje vacío para precio manual al cotizar" : undefined}
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
            placeholder="0,00"
          />
        </Field>

        {showCosts && (
          <Field label="Costo proveedor (USD)" error={errors.cost} hint="Información interna">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0,00"
            />
          </Field>
        )}

        {showCosts && (
          <Field label="Proveedor" error={errors.supplierId}>
            <Select
              value={supplierId || NONE}
              onValueChange={(v) => setSupplierId(v === NONE ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin proveedor" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                <SelectItem value={NONE}>Sin proveedor</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Mínimo de pax" error={errors.minPax}>
          <Input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={minPax}
            onChange={(e) => setMinPax(e.target.value)}
            placeholder="Ej: 30"
          />
        </Field>

        <Field label="Unidades por pax" error={errors.unitsPerPax}>
          <Input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={unitsPerPax}
            onChange={(e) => setUnitsPerPax(e.target.value)}
            placeholder="Ej: 6"
          />
        </Field>
      </div>

      <Field label="Notas" error={errors.notes}>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Condiciones, medidas, detalles del menú…"
        />
      </Field>

      {requiresReason && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-800">
            <History className="h-3.5 w-3.5" />
            <Label className="text-xs font-medium">Motivo del cambio de precio/costo *</Label>
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: ajuste de tarifa del proveedor 2026"
            maxLength={500}
            className="bg-white"
          />
          {errors.priceChangeReason ? (
            <p className="text-[11px] text-red-600">{errors.priceChangeReason}</p>
          ) : (
            <p className="text-[11px] text-amber-700">
              El cambio quedará registrado en el historial de precios con su usuario.
            </p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear producto"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
