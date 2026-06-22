// Segmento comercial de un evento (Corporativo / Institucional / Social).
//
// El sistema NO guarda un campo "segmento": clasifica por el tipo de evento
// (Opportunity.eventType, del catálogo EventTypeOption). Este mapeo es una
// heurística editable; los tipos no listados caen en "Otros". Si más adelante
// se quiere precisión por evento, conviene un campo explícito en la oportunidad.

export const EVENT_SEGMENTS = ["Corporativo", "Institucional", "Social", "Otros"] as const;
export type EventSegment = (typeof EVENT_SEGMENTS)[number];

/** Segmentos elegibles por el usuario al crear/editar una oportunidad. */
export const SELECTABLE_SEGMENTS = ["Corporativo", "Institucional", "Social"] as const;

/** tipo de evento (nombre del catálogo) → segmento comercial */
export const EVENT_SEGMENT_MAP: Record<string, EventSegment> = {
  // Corporativos
  "Reunión ejecutiva": "Corporativo",
  "Lanzamiento de producto": "Corporativo",
  Congreso: "Corporativo",
  Convención: "Corporativo",
  Networking: "Corporativo",
  "Rueda de prensa": "Corporativo",
  "Grabaciones TV": "Corporativo",
  "Sesion de Fotos": "Corporativo",
  Desayuno: "Corporativo",
  Almuerzo: "Corporativo",
  // Institucionales
  Institucional: "Institucional",
  "Evento VG": "Institucional",
  Graduación: "Institucional",
  // Sociales
  Boda: "Social",
  "Propuesta de Matrimonio": "Social",
  "Fiesta de Navidad": "Social",
  "Fiesta electronica": "Social",
  Coctel: "Social",
  Cena: "Social",
  Cumpleaños: "Social",
  Aniversario: "Social",
  Pijamada: "Social",
};

export function segmentOfEventType(eventType: string | null | undefined): EventSegment {
  const key = (eventType ?? "").trim();
  return EVENT_SEGMENT_MAP[key] ?? "Otros";
}
