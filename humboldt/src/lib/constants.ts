// Constantes de dominio — los "enums" del schema (SQLite no soporta enums)

export const ROLES = ["ADMIN", "GERENTE", "EJECUTIVO"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  EJECUTIVO: "Ejecutivo de ventas",
};

// ── Pipeline ──────────────────────────────────────────────────────────
export const STAGES = [
  "NUEVO",
  "CONTACTADO",
  "PROPUESTA",
  "NEGOCIACION",
  "GANADO",
  "PERDIDO",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  PROPUESTA: "Propuesta",
  NEGOCIACION: "Negociación",
  GANADO: "Ganado",
  PERDIDO: "Perdido",
};

export const STAGE_COLORS: Record<Stage, string> = {
  NUEVO: "bg-sky-100 text-sky-800 border-sky-200",
  CONTACTADO: "bg-violet-100 text-violet-800 border-violet-200",
  PROPUESTA: "bg-amber-100 text-amber-800 border-amber-200",
  NEGOCIACION: "bg-orange-100 text-orange-800 border-orange-200",
  GANADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PERDIDO: "bg-rose-100 text-rose-800 border-rose-200",
};

// Probabilidad por defecto al entrar a cada etapa
export const STAGE_DEFAULT_PROBABILITY: Record<Stage, number> = {
  NUEVO: 10,
  CONTACTADO: 25,
  PROPUESTA: 40,
  NEGOCIACION: 60,
  GANADO: 100,
  PERDIDO: 0,
};

export const LOST_REASONS = [
  "Precio",
  "Teleférico",
  "Capacidad de hospedaje",
  "Variedad de menú",
  "Capacidad de espacios",
  "Logística",
  "Sin respuesta del cliente",
  "Fecha no disponible",
  "Otro",
] as const;

// ── Cotizaciones ──────────────────────────────────────────────────────
export const QUOTE_STATUSES = [
  "BORRADOR",
  "ENVIADA",
  "REVISAR",
  "APROBADA",
  "RECHAZADA",
  "VENCIDA",
  "CONTRATADA",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  REVISAR: "Revisar comentario",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  VENCIDA: "Vencida",
  CONTRATADA: "Contratada",
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  BORRADOR: "bg-zinc-100 text-zinc-700 border-zinc-200",
  ENVIADA: "bg-sky-100 text-sky-800 border-sky-200",
  REVISAR: "bg-orange-100 text-orange-800 border-orange-200",
  APROBADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RECHAZADA: "bg-rose-100 text-rose-800 border-rose-200",
  VENCIDA: "bg-amber-100 text-amber-800 border-amber-200",
  CONTRATADA: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

export const SECTIONS = [
  "MISCELANEOS",
  "TRASLADOS",
  "ALIMENTOS_BEBIDAS",
  "ESPACIOS",
] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  MISCELANEOS: "Misceláneos",
  TRASLADOS: "Traslados",
  ALIMENTOS_BEBIDAS: "Alimentos y Bebidas",
  ESPACIOS: "Espacios",
};

export const UNITS = [
  "UND",
  "PAX",
  "BOTELLA",
  "DIA",
  "EVENTO",
  "VEHICULO",
  "KG",
  "CAJA",
  "HORA",
] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  UND: "Unidad",
  PAX: "Por persona",
  BOTELLA: "Botella",
  DIA: "Día",
  EVENTO: "Evento",
  VEHICULO: "Vehículo",
  KG: "Kg",
  CAJA: "Caja",
  HORA: "Hora",
};

export const DISCOUNT_TYPES = [
  "DESCUENTO",
  "PRECIO_ESPECIAL",
  "CORTESIA",
  "SOBREPRECIO",
] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  DESCUENTO: "Descuento",
  PRECIO_ESPECIAL: "Precio especial",
  CORTESIA: "Cortesía",
  SOBREPRECIO: "Sobreprecio",
};

// ── Productos ─────────────────────────────────────────────────────────
export const PRODUCT_TYPES = [
  "PROPIO",
  "PROVEEDOR",
  "ESPACIO",
  "HOSPEDAJE",
  "SERVICIO",
  "INSUMO",
  "COMODIN",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  PROPIO: "Propio",
  PROVEEDOR: "Proveedor",
  ESPACIO: "Espacio",
  HOSPEDAJE: "Hospedaje",
  SERVICIO: "Servicio",
  INSUMO: "Insumo",
  COMODIN: "Comodín (precio manual)",
};

// ── Calendario / reservas ─────────────────────────────────────────────
export const RESERVATION_STATUSES = ["TENTATIVA", "CONFIRMADA", "CANCELADA"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  TENTATIVA: "Tentativa",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
};

// ── Pagos ─────────────────────────────────────────────────────────────
export const PAYMENT_METHODS = [
  "BOLIVARES",
  "ZELLE",
  "EFECTIVO_DIVISAS",
  "TARJETA_DEBITO",
  "TARJETA_CREDITO",
  "TRANSFERENCIA",
  "OBSEQUIO",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BOLIVARES: "Bolívares (transferencia/pago móvil)",
  ZELLE: "Zelle",
  EFECTIVO_DIVISAS: "Divisas en efectivo",
  TARJETA_DEBITO: "Tarjeta de débito",
  TARJETA_CREDITO: "Tarjeta de crédito",
  TRANSFERENCIA: "Transferencia USD",
  OBSEQUIO: "Obsequio / Cortesía",
};

/** Métodos coherentes con la moneda del banco. OBSEQUIO aplica a ambas. */
export const CURRENCY_METHODS: Record<"BS" | "USD", PaymentMethod[]> = {
  BS: ["BOLIVARES", "TARJETA_DEBITO", "TARJETA_CREDITO", "OBSEQUIO"],
  USD: ["ZELLE", "EFECTIVO_DIVISAS", "TRANSFERENCIA", "OBSEQUIO"],
};

/** Moneda que fija cada método de pago (BOTH = no fuerza moneda, ej. obsequio). */
export const METHOD_CURRENCY: Record<PaymentMethod, "BS" | "USD" | "BOTH"> = {
  BOLIVARES: "BS",
  TARJETA_DEBITO: "BS",
  TARJETA_CREDITO: "BS",
  TRANSFERENCIA: "USD",
  ZELLE: "USD",
  EFECTIVO_DIVISAS: "USD",
  OBSEQUIO: "BOTH",
};

export const PAYMENT_TYPES = ["ABONO", "ANTICIPO", "GARANTIA", "REINTEGRO"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  ABONO: "Abono",
  ANTICIPO: "Anticipo",
  GARANTIA: "Garantía (depósito)",
  REINTEGRO: "Reintegro",
};

// ── Bancos / cuentas de recepción ─────────────────────────────────────
export const BANK_ACCOUNT_TYPES = ["BANCO", "ZELLE", "EFECTIVO"] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  BANCO: "Banco (transferencia / pago móvil)",
  ZELLE: "Zelle",
  EFECTIVO: "Efectivo / Caja",
};

export const INSTALLMENT_STATUSES = ["PENDIENTE", "PARCIAL", "PAGADA", "VENCIDA"] as const;

// ── Claves de configuración ───────────────────────────────────────────
export const SETTING_KEYS = {
  IVA_PCT: "iva_pct",
  SERVICE_PCT: "service_pct",
  DEPOSIT_PCT: "deposit_pct",
  IGTF_PCT: "igtf_pct",
  QUOTE_VALIDITY_DAYS: "quote_validity_days",
  DEFAULT_MARKUP_PCT: "default_markup_pct",
  MIN_MARGIN_PCT: "min_margin_pct",
  HOTEL_NAME: "hotel_name",
  HOTEL_RIF: "hotel_rif",
  HOTEL_ADDRESS: "hotel_address",
  HOTEL_PHONE: "hotel_phone",
  HOTEL_EMAIL: "hotel_email",
  QUOTE_LEGAL_CONDITIONS: "quote_legal_conditions",
  QUOTE_GREETING: "quote_greeting",
  // Metas comerciales (para el informe de gestión)
  GOAL_MONTHLY_SALES: "goal_monthly_sales",
  GOAL_MONTHLY_SPACES: "goal_monthly_spaces",
  GOAL_CONVERSION_PCT: "goal_conversion_pct",
} as const;

// ── Tareas ────────────────────────────────────────────────────────────
export const TASK_TYPES = [
  "VOLVER_CONTACTAR",
  "ENVIAR_COTIZACION",
  "LLAMAR",
  "GESTION_COBRO",
  "REUNION",
  "OTRO",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  VOLVER_CONTACTAR: "Volver a contactar",
  ENVIAR_COTIZACION: "Enviar cotización",
  LLAMAR: "Llamar",
  GESTION_COBRO: "Gestión de cobro",
  REUNION: "Reunión",
  OTRO: "Otro",
};

export const TASK_STATUSES = ["PENDIENTE", "COMPLETADA", "CANCELADA"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDIENTE: "Pendiente",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

export const RECURRENCES = ["NONE", "DIARIA", "SEMANAL", "QUINCENAL", "MENSUAL"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  NONE: "No se repite",
  DIARIA: "Cada día",
  SEMANAL: "Cada semana",
  QUINCENAL: "Cada 15 días",
  MENSUAL: "Cada mes",
};
