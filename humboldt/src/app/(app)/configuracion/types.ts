// Tipos compartidos del módulo Configuración

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type CatalogKind = "eventType" | "channel";

export interface CatalogItem {
  id: string;
  name: string;
  active: boolean;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
}

export interface RateInfo {
  rate: number;
  date: Date;
  source: string; // BCV | MANUAL | CACHE
}
