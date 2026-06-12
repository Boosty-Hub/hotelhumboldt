// Metadatos compartidos del módulo Configuración

// Notas explicativas bajo cada parámetro comercial
export const PARAM_NOTES: Record<string, string> = {
  iva_pct:
    "El IVA se calcula sobre Misceláneos + AyB + Espacios; los traslados están exentos. Se factura en bolívares a tasa BCV.",
  service_pct:
    "El cargo de servicio aplica únicamente sobre Alimentos y Bebidas y no forma parte de la base imponible del IVA.",
  igtf_pct:
    "Informativo: aplica solo cuando el cliente paga en divisas. No se suma al total de la cotización.",
  deposit_pct:
    "Garantía reembolsable que se cobra como depósito separado para cubrir consumos adicionales o daños. No se suma al total del evento.",
  quote_validity_days:
    "Días continuos de vigencia de cada cotización desde su fecha de emisión.",
  default_markup_pct:
    "Markup sugerido sobre el costo del proveedor al fijar precios de venta. Información interna.",
  min_margin_pct:
    "Si está habilitado, el cotizador alertará cuando el margen de una línea quede por debajo de este valor. Información interna.",
};

// Orden de presentación dentro de cada grupo
export const PARAM_ORDER = [
  "iva_pct",
  "service_pct",
  "igtf_pct",
  "deposit_pct",
  "quote_validity_days",
  "default_markup_pct",
  "min_margin_pct",
];

export const RATE_SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  BCV: { label: "BCV", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  MANUAL: { label: "Manual", className: "bg-amber-100 text-amber-800 border-amber-200" },
};

export function suffixFor(key: string): string {
  if (key.endsWith("_pct")) return "%";
  if (key.endsWith("_days")) return "días";
  return "";
}
