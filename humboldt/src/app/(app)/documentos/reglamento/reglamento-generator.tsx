"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocFrame } from "@/components/documents/doc-frame";
import { ReglamentoTemplate } from "@/components/documents/reglamento-template";

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

export function ReglamentoGenerator({ today }: { today: string }) {
  const [empresa, setEmpresa] = useState("");
  const [responsable, setResponsable] = useState("");
  const [fecha, setFecha] = useState(today);
  const [hora, setHora] = useState("");

  return (
    <DocFrame
      title="Reglamento de proveedores"
      form={
        <>
          <Field label="Empresa proveedora" value={empresa} onChange={setEmpresa} />
          <Field label="Responsable" value={responsable} onChange={setResponsable} />
          <Field label="Fecha" value={fecha} onChange={setFecha} />
          <Field label="Hora" value={hora} onChange={setHora} placeholder="ej. 10:00 a.m." />
          <p className="text-xs text-muted-foreground">
            El contenido del reglamento no se modifica; solo se completa la declaración final.
          </p>
        </>
      }
    >
      <ReglamentoTemplate fields={{ empresa, responsable, fecha, hora }} />
    </DocFrame>
  );
}
