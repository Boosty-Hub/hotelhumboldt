"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

/**
 * Descarga el BEO como PDF nativo (generado en /orden/[token]/pdf). Descarga
 * directa, sin previsualización ni diálogo de impresión.
 */
export function BeoDownloadButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);

  function download() {
    setBusy(true);
    const a = document.createElement("a");
    a.href = `/orden/${token}/pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => setBusy(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md bg-sky-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-900 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {busy ? "Generando…" : "Descargar PDF"}
    </button>
  );
}
