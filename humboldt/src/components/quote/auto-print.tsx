"use client";

import { useEffect } from "react";

/**
 * Abre el diálogo de impresión al cargar la vista del documento (cuando se llega
 * con ?print=1, ej. desde la acción "PDF" del listado). El pequeño delay asegura
 * que el documento ya está pintado antes de imprimir.
 */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
