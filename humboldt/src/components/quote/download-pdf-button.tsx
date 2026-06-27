"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Descarga el documento de cotización como PDF NATIVO (texto seleccionable,
 * generado en el servidor con @react-pdf/renderer en /cotizaciones/[id]/pdf).
 * La respuesta es un attachment, así que el navegador la descarga sin salir de
 * la página. Si `auto` es true (llegada con ?print=1), descarga al montar.
 */
export function DownloadPdfButton({
  quoteId,
  auto = false,
}: {
  quoteId: string;
  auto?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);

  const download = () => {
    setBusy(true);
    const a = document.createElement("a");
    a.href = `/cotizaciones/${quoteId}/pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // El navegador maneja la descarga; liberamos el botón al poco rato.
    window.setTimeout(() => setBusy(false), 1500);
  };

  useEffect(() => {
    if (!auto || startedRef.current) return;
    startedRef.current = true;
    const t = setTimeout(download, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <Button onClick={download} type="button" disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? "Generando…" : "Descargar PDF"}
    </Button>
  );
}
