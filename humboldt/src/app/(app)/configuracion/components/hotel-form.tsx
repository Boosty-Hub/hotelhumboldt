"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveHotelSettingsAction } from "../actions";

interface HotelFormProps {
  values: Record<string, string>;
}

const TEXT_FIELDS: {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}[] = [
  { key: "hotel_name", label: "Nombre del hotel", required: true },
  { key: "hotel_rif", label: "RIF", placeholder: "J-00000000-0" },
  { key: "hotel_address", label: "Dirección" },
  { key: "hotel_phone", label: "Teléfono", placeholder: "+58 212 000 00 00" },
  { key: "hotel_email", label: "Correo de ventas", type: "email", placeholder: "ventas@hotelhumboldt.com" },
];

/** Formulario de identidad del hotel y textos de cotización. */
export function HotelForm({ values }: HotelFormProps) {
  const [form, setForm] = useState<Record<string, string>>({
    hotel_name: values.hotel_name ?? "",
    hotel_rif: values.hotel_rif ?? "",
    hotel_address: values.hotel_address ?? "",
    hotel_phone: values.hotel_phone ?? "",
    hotel_email: values.hotel_email ?? "",
    quote_greeting: values.quote_greeting ?? "",
    quote_legal_conditions: values.quote_legal_conditions ?? "",
  });
  const [pending, startTransition] = useTransition();

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveHotelSettingsAction(form);
      if (res.ok) toast.success(res.message ?? "Datos guardados.");
      else toast.error(res.error);
    });
  }

  const clauseCount = form.quote_legal_conditions
    .split("\n")
    .filter((l) => l.trim().length > 0).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identidad del hotel</CardTitle>
          <CardDescription>
            Estos datos aparecen en el encabezado de las cotizaciones y documentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.key === "hotel_address" ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={f.key}>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id={f.key}
                type={f.type ?? "text"}
                value={form[f.key]}
                onChange={set(f.key)}
                placeholder={f.placeholder}
                required={f.required}
                disabled={pending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Textos de cotización</CardTitle>
          <CardDescription>
            Se incluyen automáticamente en cada cotización nueva; el ejecutivo puede ajustarlos
            caso por caso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="quote_greeting">Mensaje de cortesía</Label>
            <Textarea
              id="quote_greeting"
              rows={3}
              value={form.quote_greeting}
              onChange={set("quote_greeting")}
              disabled={pending}
              placeholder="Reciba un cordial saludo del equipo del Hotel Humboldt…"
            />
            <p className="text-xs text-muted-foreground">
              Saludo que encabeza la propuesta enviada al cliente.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="quote_legal_conditions">Condiciones legales</Label>
              <span className="text-xs text-muted-foreground">
                {clauseCount} {clauseCount === 1 ? "cláusula" : "cláusulas"}
              </span>
            </div>
            <Textarea
              id="quote_legal_conditions"
              rows={12}
              value={form.quote_legal_conditions}
              onChange={set("quote_legal_conditions")}
              disabled={pending}
              className="font-mono text-xs leading-relaxed"
              placeholder="Escribe una cláusula por línea…"
            />
            <p className="text-xs text-muted-foreground">
              Una cláusula por línea — se listan numeradas al final de cada cotización.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save data-icon="inline-start" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
