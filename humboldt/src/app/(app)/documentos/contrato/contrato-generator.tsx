"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocFrame } from "@/components/documents/doc-frame";
import { ContratoTemplate, type ContratoFields } from "@/components/documents/contrato-template";

export interface ClienteOption {
  id: string;
  legalName: string;
  brandName: string | null;
  rif: string | null;
  address: string | null;
  contacts: { id: string; name: string; title: string | null }[];
}

export interface QuoteContratoOption {
  id: string;
  numero: string;
  label: string;
  cliente: string;
  rif: string;
  direccion: string;
  representante: string;
  contacto: string;
  fechaEvento: string;
  horario: string;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function ContratoGenerator({
  clients,
  quotes,
  fechaContratoLarga,
}: {
  clients: ClienteOption[];
  quotes: QuoteContratoOption[];
  fechaContratoLarga: string;
}) {
  const [clientId, setClientId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [quoteId, setQuoteId] = useState<string>("");

  const [f, setF] = useState<ContratoFields>({
    cliente: "",
    rif: "",
    direccion: "",
    representante: "",
    cedula: "",
    fechaEvento: "",
    horario: "",
    contactoCliente: "",
    fechaContratoLarga,
    numeroCotizacion: "",
  });
  const set = (k: keyof ContratoFields) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  function onSelectQuote(id: string) {
    setQuoteId(id);
    const q = quotes.find((x) => x.id === id);
    if (!q) return;
    setClientId(""); // el contrato queda atado a la cotización
    setContactId("");
    setF((cur) => ({
      ...cur,
      cliente: q.cliente,
      rif: q.rif,
      direccion: q.direccion,
      representante: q.representante,
      contactoCliente: q.contacto,
      fechaEvento: q.fechaEvento,
      horario: q.horario,
      numeroCotizacion: q.numero,
    }));
  }

  function onSelectClient(id: string) {
    setClientId(id);
    setContactId("");
    const c = clients.find((x) => x.id === id);
    if (c) {
      setF((cur) => ({
        ...cur,
        cliente: c.brandName ?? c.legalName,
        rif: c.rif ?? "",
        direccion: c.address ?? "",
      }));
    }
  }

  function onSelectContact(id: string) {
    setContactId(id);
    const ct = selectedClient?.contacts.find((x) => x.id === id);
    if (ct) {
      setF((cur) => ({ ...cur, representante: ct.name, contactoCliente: ct.name }));
    }
  }

  return (
    <DocFrame
      title="Contrato de evento"
      form={
        <>
          <div className="space-y-1">
            <Label className="text-xs">Cotización aprobada / ganada</Label>
            <Select value={quoteId} onValueChange={onSelectQuote}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí la cotización…" />
              </SelectTrigger>
              <SelectContent>
                {quotes.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No hay cotizaciones aprobadas o contratadas.
                  </div>
                ) : (
                  quotes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              El contrato queda atado al número de cotización. También podés cargar un cliente
              manualmente abajo.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Cliente</Label>
            <Select value={clientId} onValueChange={onSelectClient}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí un cliente…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.brandName ?? c.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClient && selectedClient.contacts.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Contacto (representante)</Label>
              <Select value={contactId} onValueChange={onSelectContact}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí un contacto…" />
                </SelectTrigger>
                <SelectContent>
                  {selectedClient.contacts.map((ct) => (
                    <SelectItem key={ct.id} value={ct.id}>
                      {ct.name}
                      {ct.title ? ` · ${ct.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Datos del contrato (editables)
          </p>
          <Field
            label="N° de cotización"
            value={f.numeroCotizacion ?? ""}
            onChange={set("numeroCotizacion")}
            placeholder="ej. COT-2026-0001"
          />
          <Field label="Razón social" value={f.cliente} onChange={set("cliente")} />
          <Field label="RIF" value={f.rif} onChange={set("rif")} />
          <Field label="Dirección" value={f.direccion} onChange={set("direccion")} />
          <Field label="Representante (firma)" value={f.representante} onChange={set("representante")} />
          <Field label="Cédula del representante" value={f.cedula} onChange={set("cedula")} placeholder="V- 0.000.000" />
          <Field label="Fecha del evento" value={f.fechaEvento} onChange={set("fechaEvento")} placeholder="ej. 12 de julio de 2025" />
          <Field label="Horario" value={f.horario} onChange={set("horario")} placeholder="ej. 03:00 P.M. A 12:00 A.M." />
          <Field label="Contacto del cliente (notificaciones)" value={f.contactoCliente} onChange={set("contactoCliente")} />
          <Field label="Fecha del contrato" value={f.fechaContratoLarga} onChange={set("fechaContratoLarga")} />

          <p className="text-xs text-muted-foreground">
            El texto legal del contrato no se modifica; solo se completan estos datos.
          </p>
        </>
      }
    >
      <ContratoTemplate fields={f} />
    </DocFrame>
  );
}
