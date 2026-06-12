"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveSupplier } from "./actions";
import type { SupplierRow } from "./supplier-shared";

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierRow | null; // null = crear
}

export function SupplierDialog({ open, onOpenChange, supplier }: SupplierDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>
            {supplier
              ? "Actualice los datos y condiciones del proveedor."
              : "Registre un proveedor de servicios para los eventos del hotel."}
          </DialogDescription>
        </DialogHeader>
        <SupplierForm
          key={supplier?.id ?? "nuevo"}
          supplier={supplier}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SupplierForm({
  supplier,
  onDone,
}: {
  supplier: SupplierRow | null;
  onDone: () => void;
}) {
  const isEditing = !!supplier;
  const [name, setName] = useState(supplier?.name ?? "");
  const [serviceType, setServiceType] = useState(supplier?.serviceType ?? "");
  const [contactName, setContactName] = useState(supplier?.contactName ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [discountPct, setDiscountPct] = useState(supplier?.discountPct?.toString() ?? "");
  const [appliesIva, setAppliesIva] = useState(supplier?.appliesIva ?? false);
  const [conditions, setConditions] = useState(supplier?.conditions ?? "");
  const [active, setActive] = useState(supplier?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dctoRaw = discountPct.trim().replace(",", ".");
    const dcto = dctoRaw ? Number(dctoRaw) : null;
    startTransition(async () => {
      const res = await saveSupplier({
        id: supplier?.id ?? null,
        name,
        serviceType: serviceType.trim() || null,
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        discountPct: dcto != null && Number.isFinite(dcto) ? dcto : null,
        appliesIva,
        conditions: conditions.trim() || null,
        active,
      });
      if (res.ok) {
        toast.success(isEditing ? "Proveedor actualizado" : "Proveedor creado");
        onDone();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Nombre / razón social *" error={errors.name}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Alternativa Gastronómica 2023 C.A."
          autoFocus
          maxLength={160}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo de servicio" error={errors.serviceType}>
          <Input
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            placeholder="catering, vinos, audiovisuales…"
            maxLength={80}
          />
        </Field>
        <Field label="Persona de contacto" error={errors.contactName}>
          <Input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Nombre del contacto"
            maxLength={120}
          />
        </Field>
        <Field label="Teléfono" error={errors.phone}>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0414-0000000"
            maxLength={40}
          />
        </Field>
        <Field label="Correo electrónico" error={errors.email}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contacto@proveedor.com"
            maxLength={120}
          />
        </Field>
        <Field
          label="Descuento fijo al hotel (%)"
          error={errors.discountPct}
          hint="Ej: A.G. otorga 30% de descuento"
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            max="100"
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
            placeholder="0"
          />
        </Field>
        <div className="space-y-2.5 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Switch size="sm" checked={appliesIva} onCheckedChange={setAppliesIva} />
            Cobra «+ IVA» sobre sus tarifas
          </label>
          {isEditing && (
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Switch size="sm" checked={active} onCheckedChange={setActive} />
              Proveedor activo
            </label>
          )}
        </div>
      </div>

      <Field label="Condiciones comerciales" error={errors.conditions}>
        <Textarea
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          rows={3}
          placeholder="Forma de pago, plazos, mínimos, acuerdos especiales…"
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear proveedor"}
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
