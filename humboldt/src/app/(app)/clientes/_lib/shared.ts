// Constantes y helpers locales del módulo Clientes.
// Nota: los tipos de cliente (Client.type) y de actividad (Activity.type)
// no están en src/lib/constants.ts, por eso se definen aquí.

export const CLIENT_TYPES = [
  "EMPRESA",
  "PERSONA",
  "AGENCIA",
  "INSTITUCIONAL",
] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  EMPRESA: "Empresa",
  PERSONA: "Persona natural",
  AGENCIA: "Agencia",
  INSTITUCIONAL: "Institucional",
};

export const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  EMPRESA: "bg-sky-100 text-sky-800 border-sky-200",
  PERSONA: "bg-amber-100 text-amber-800 border-amber-200",
  AGENCIA: "bg-violet-100 text-violet-800 border-violet-200",
  INSTITUCIONAL: "bg-teal-100 text-teal-800 border-teal-200",
};

export function isClientType(value: string): value is ClientType {
  return (CLIENT_TYPES as readonly string[]).includes(value);
}

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  NOTA: "Nota",
  LLAMADA: "Llamada",
  EMAIL: "Correo",
  REUNION: "Reunión",
  DEGUSTACION: "Degustación",
  CAMBIO_ETAPA: "Cambio de etapa",
  SISTEMA: "Sistema",
};

/** Iniciales para el avatar (máx. 2 letras). */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]/.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
