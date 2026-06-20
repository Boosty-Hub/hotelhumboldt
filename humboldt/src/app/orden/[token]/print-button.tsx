"use client";

import { Printer } from "lucide-react";

export function BeoPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md bg-sky-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-900"
    >
      <Printer className="size-3.5" />
      Imprimir / Guardar PDF
    </button>
  );
}
