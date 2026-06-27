"use server";

// Server actions del módulo Cotizador.
// Toda mutación valida con zod, recalcula totales EN EL SERVIDOR con
// calcQuoteTotals y registra Activity. Nunca se confía en el cliente.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nanoid } from "nanoid";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auth, canViewCosts, canDeleteQuotes, canApplyQuoteDiscount } from "@/lib/auth";
import { getCommercialParams, getSetting } from "@/lib/settings";
import { calcQuoteTotals, isPriceOverride, lineCost, lineSubtotal } from "@/lib/quote-calc";
import { round2 } from "@/lib/money";
import { dateKeyToUtcDate, toDayKey } from "@/lib/dates";
import {
  reserveQuoteSpaces,
  checkSpaceConflicts,
  promoteQuoteReservations,
  notifyReleaseQuoteReservations,
} from "@/lib/reservations";
import {
  SECTIONS,
  DISCOUNT_TYPES,
  QUOTE_STATUSES,
  STAGE_DEFAULT_PROBABILITY,
  SETTING_KEYS,
  type QuoteStatus,
} from "@/lib/constants";
import { quoteBaseNumber, type SaveLineInput } from "@/components/quote/quote-utils";

// ─────────────────────────── Helpers ───────────────────────────

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  return session;
}

/** Próximo número COT-AAAA-NNNN del año en curso. */
async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `COT-${year}-`;
  const last = await prisma.quote.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  let n = 1;
  if (last) {
    const m = last.number.slice(prefix.length).match(/^(\d{4})/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Próximo código OP-AAAA-NNNN para oportunidades creadas desde el cotizador. */
async function nextOpportunityCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OP-${year}-`;
  const last = await prisma.opportunity.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let n = 1;
  if (last) {
    const m = last.code.slice(prefix.length).match(/^(\d{4})/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}

function revalidateQuotePaths(id: string) {
  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${id}`);
  revalidatePath(`/cotizaciones/${id}/editar`);
  // El total de la cotización sincroniza el valor de la oportunidad → pipeline,
  // dashboard y ficha de cliente muestran ese valor.
  revalidatePath("/pipeline");
  revalidatePath("/clientes");
  revalidatePath("/");
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// ──────────────── Crear oportunidad desde el cotizador ────────────────
// Toda cotización nace de una oportunidad. Cuando no existe, se crea aquí
// mismo, SIEMPRE atada a un contacto existente (el cliente se deduce de él).

const createOppForQuoteSchema = z.object({
  contactId: z.string().min(1, "Selecciona un contacto"),
  // Empresa OPCIONAL: el contacto puede no tener empresa.
  clientId: z.string().trim().optional().or(z.literal("")),
  title: z
    .string()
    .trim()
    .min(3, "El título debe tener al menos 3 caracteres")
    .max(160, "El título es demasiado largo"),
  eventType: z.string().trim().min(1).optional().or(z.literal("")),
  segment: z.string().trim().min(1).optional().or(z.literal("")),
  channel: z.string().trim().min(1).optional().or(z.literal("")),
  expectedEventDate: z.string().trim().optional().or(z.literal("")), // yyyy-MM-dd
  pax: z.coerce.number().int().positive().optional(),
  estimatedValue: z.coerce.number().min(0).optional(),
});

export type CreateOppForQuoteInput = z.input<typeof createOppForQuoteSchema>;

/** Opción de oportunidad lista para inyectar en el selector del cotizador. */
export interface NewOppOption {
  id: string;
  code: string;
  title: string;
  clientName: string;
  expectedEventDate: string | null; // yyyy-MM-dd
  pax: number | null;
}

export async function createOpportunityForQuote(
  input: CreateOppForQuoteInput
): Promise<{ ok: true; opportunity: NewOppOption } | { ok: false; error: string }> {
  const session = await requireSession();

  const parsed = createOppForQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  // El contacto debe existir. La empresa es opcional; si viene, debe existir.
  const [contact, client] = await Promise.all([
    prisma.contact.findUnique({
      where: { id: data.contactId },
      select: { id: true, name: true },
    }),
    data.clientId
      ? prisma.client.findUnique({
          where: { id: data.clientId },
          select: { id: true, legalName: true, brandName: true },
        })
      : Promise.resolve(null),
  ]);
  if (!contact) return { ok: false, error: "El contacto seleccionado no existe" };
  if (data.clientId && !client) {
    return { ok: false, error: "La empresa (cliente) seleccionada no existe" };
  }

  const expectedEventDate = data.expectedEventDate
    ? dateKeyToUtcDate(data.expectedEventDate)
    : null;

  // Reintenta ante colisión del código secuencial (creaciones concurrentes).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const code = await nextOpportunityCode();
      const opp = await prisma.$transaction(async (tx) => {
        // Si hay empresa, asegura el vínculo contacto↔empresa (no pisa si ya existe).
        if (client) {
          await tx.clientContact.upsert({
            where: { clientId_contactId: { clientId: client.id, contactId: contact.id } },
            update: {},
            create: { clientId: client.id, contactId: contact.id },
          });
        }
        const created = await tx.opportunity.create({
          data: {
            code,
            clientId: client?.id ?? null,
            contactId: contact.id,
            ownerId: session.user.id,
            title: data.title,
            eventType: data.eventType || null,
            segment: data.segment || null,
            channel: data.channel || null,
            expectedEventDate,
            pax: data.pax ?? null,
            estimatedValue: data.estimatedValue ?? 0,
            stage: "PROPUESTA",
            probability: STAGE_DEFAULT_PROBABILITY.PROPUESTA,
          },
        });
        await tx.activity.create({
          data: {
            userId: session.user.id,
            opportunityId: created.id,
            type: "SISTEMA",
            body: `Oportunidad ${code} creada desde el cotizador`,
          },
        });
        return created;
      });

      revalidatePath("/pipeline");
      revalidatePath("/clientes");
      return {
        ok: true,
        opportunity: {
          id: opp.id,
          code: opp.code,
          title: opp.title,
          clientName: client ? client.brandName ?? client.legalName : contact.name,
          expectedEventDate: opp.expectedEventDate ? toDayKey(opp.expectedEventDate) : null,
          pax: opp.pax,
        },
      };
    } catch (err) {
      const isUniqueViolation =
        typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
      if (isUniqueViolation && attempt < 2) continue;
      return { ok: false, error: "No se pudo crear la oportunidad. Verifica los datos." };
    }
  }
  return { ok: false, error: "No se pudo generar el código de la oportunidad." };
}

// ─────────────────────────── Crear cotización ───────────────────────────

const createQuoteSchema = z.object({
  // Toda cotización nace de una oportunidad (existente o creada en el cotizador).
  opportunityId: z.string().trim().min(1, "Selecciona una oportunidad"),
  eventName: z.string().trim().min(3, "El nombre del evento debe tener al menos 3 caracteres"),
  startDate: z.string().trim().optional().or(z.literal("")), // yyyy-MM-dd
  datesTentative: z.boolean().default(false),
  startTime: z.string().trim().optional().or(z.literal("")),
  endTime: z.string().trim().optional().or(z.literal("")),
  pax: z.coerce.number().int().min(0).optional(),
  paxApproximate: z.boolean().default(false),
  daysCount: z.coerce.number().int().min(1, "Mínimo 1 día").max(30, "Máximo 30 días").default(1),
  spaceIds: z.array(z.string()).optional().default([]), // salones a reservar (tentativo)
});

export type CreateQuoteInput = z.input<typeof createQuoteSchema>;

export async function createQuote(input: CreateQuoteInput): Promise<{ ok: false; error: string }> {
  const session = await requireSession();

  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  let quoteId: string;
  let reservedCount = 0;
  let blockedCount = 0;
  try {
    // 1) La oportunidad debe existir.
    const opportunityId = data.opportunityId;
    const exists = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "La oportunidad seleccionada no existe" };

    // 2) Evento: reutiliza el de la oportunidad si existe; si no, lo crea.
    // Fechas a medianoche UTC (canónico) para que coincidan con el calendario.
    const startDate = data.startDate ? dateKeyToUtcDate(data.startDate) : null;
    const endDate = startDate ? addDays(startDate, data.daysCount - 1) : null;
    const eventData = {
      name: data.eventName,
      startDate,
      endDate,
      datesTentative: data.datesTentative,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      pax: data.pax ?? null,
      paxApproximate: data.paxApproximate,
    };
    // Solo reutilizar un evento "virgen" (sin cotizaciones ni reservas colgando):
    // pisar el nombre/fechas de un evento ya cotizado o con reservas confirmadas
    // corrompería esos registros. Si no hay uno limpio, se crea uno nuevo.
    const reusableEvent = await prisma.event.findFirst({
      where: { opportunityId, quotes: { none: {} }, reservations: { none: {} } },
      orderBy: { createdAt: "desc" },
    });
    const event = reusableEvent
      ? await prisma.event.update({ where: { id: reusableEvent.id }, data: eventData })
      : await prisma.event.create({ data: { opportunityId, ...eventData } });

    // 3) Snapshot de parámetros comerciales + textos de Configuración
    const params = await getCommercialParams();
    const [legalConditions, clientMessage] = await Promise.all([
      getSetting(SETTING_KEYS.QUOTE_LEGAL_CONDITIONS),
      getSetting(SETTING_KEYS.QUOTE_GREETING),
    ]);

    // Número + cotización + actividad en una transacción, con reintento ante
    // colisión del secuencial (creaciones concurrentes).
    let createdId: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const number = await nextQuoteNumber();
      try {
        createdId = await prisma.$transaction(async (tx) => {
          const quote = await tx.quote.create({
            data: {
              number,
              version: 1,
              opportunityId,
              eventId: event.id,
              signerId: session.user.id,
              status: "BORRADOR",
              publicToken: nanoid(12),
              validUntil: addDays(new Date(), params.quoteValidityDays),
              clientMessage,
              legalConditions,
              taxPct: params.taxPct,
              taxEnabled: params.taxEnabled,
              servicePct: params.servicePct,
              serviceEnabled: params.serviceEnabled,
              depositPct: params.depositPct,
              depositEnabled: params.depositEnabled,
              igtfPct: params.igtfPct,
              igtfEnabled: params.igtfEnabled,
            },
          });
          await tx.activity.create({
            data: {
              userId: session.user.id,
              opportunityId,
              quoteId: quote.id,
              type: "SISTEMA",
              body: `Cotización ${number} creada (borrador)`,
            },
          });
          return quote.id;
        });
        break;
      } catch (err) {
        const isUniqueViolation =
          typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
        if (isUniqueViolation && attempt < 2) continue;
        throw err;
      }
    }
    if (!createdId) return { ok: false, error: "No se pudo generar el número de la cotización." };
    quoteId = createdId;

    // 4) Reserva tentativa de los salones elegidos. No bloquea la creación:
    // si un salón ya está confirmado esas fechas, simplemente no se reserva.
    if (data.spaceIds.length > 0) {
      try {
        const r = await reserveQuoteSpaces(quoteId, data.spaceIds, {
          id: session.user.id,
          name: session.user.name,
        });
        reservedCount = r.reservedSpaces.length;
        blockedCount = r.blocked.length;
      } catch (err) {
        console.error("reserveQuoteSpaces", err);
      }
    }
  } catch (e) {
    console.error("createQuote", e);
    return { ok: false, error: "No se pudo crear la cotización. Intenta de nuevo." };
  }

  revalidatePath("/cotizaciones");
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
  revalidatePath("/configuracion/salones");
  // Avisar al editor cuántos salones se reservaron (toast + link al calendario del mes del evento).
  const notice = new URLSearchParams();
  if (reservedCount > 0) notice.set("reservadas", String(reservedCount));
  if (blockedCount > 0) notice.set("bloqueadas", String(blockedCount));
  if ((reservedCount > 0 || blockedCount > 0) && data.startDate) {
    notice.set("mes", data.startDate.slice(0, 7));
  }
  const qs = notice.toString();
  redirect(`/cotizaciones/${quoteId}/editar${qs ? `?${qs}` : ""}`);
}

export type SpaceAvailability = {
  spaceId: string;
  status: "free" | "tentative" | "confirmed";
  detail: string;
};

/** Disponibilidad de salones para un rango de fechas — semáforo del cotizador. */
export async function checkSpaceAvailability(input: {
  spaceIds: string[];
  startDate: string;
  daysCount: number;
}): Promise<SpaceAvailability[]> {
  await requireSession();
  if (!input.startDate || input.spaceIds.length === 0) return [];

  const start = dateKeyToUtcDate(input.startDate);
  const days = Math.min(Math.max(Math.trunc(input.daysCount) || 1, 1), 30);
  const keys: string[] = [];
  for (let i = 0; i < days; i++) keys.push(toDayKey(addDays(start, i)));

  const out: SpaceAvailability[] = [];
  for (const spaceId of input.spaceIds) {
    const c = await checkSpaceConflicts(spaceId, keys);
    if (c.confirmed.length > 0) {
      out.push({ spaceId, status: "confirmed", detail: c.confirmed.map((x) => x.label).join(", ") });
    } else if (c.tentative.length > 0) {
      out.push({ spaceId, status: "tentative", detail: c.tentative.map((x) => x.label).join(", ") });
    } else {
      out.push({ spaceId, status: "free", detail: "" });
    }
  }
  return out;
}

// ─────────────────────────── Guardar líneas ───────────────────────────

const lineSchema = z.object({
  id: z.string().optional(),
  section: z.enum(SECTIONS),
  dayNumber: z.number().int().min(1).max(30).nullable(),
  productId: z.string().nullable(),
  description: z.string().trim().min(1, "Toda línea necesita descripción"),
  comment: z.string().trim().max(2000).nullable(),
  listPrice: z.number().min(0).nullable(),
  unitPrice: z.number().min(0, "El precio no puede ser negativo"),
  quantity: z.number().min(0, "La cantidad no puede ser negativa"),
  unit: z.string().trim().min(1).max(20),
  isOptional: z.boolean(),
  taxExempt: z.boolean(),
  sortOrder: z.number().int(),
  discountType: z.enum(DISCOUNT_TYPES).nullable(),
  discountReason: z.string().trim().max(500).nullable(),
  unitCost: z.number().min(0).nullable().optional(),
  costQuantity: z.number().min(0).nullable().optional(),
  supplierId: z.string().nullable().optional(),
});

const saveLinesSchema = z.array(lineSchema).max(300, "Demasiadas líneas");

const EDITABLE_STATUSES: QuoteStatus[] = ["BORRADOR", "ENVIADA"];

export async function saveQuoteLines(
  quoteId: string,
  rawLines: SaveLineInput[],
  meta?: {
    rateUsed: number | null;
    rateKind: string | null;
    discountPct?: number;
    discountReason?: string | null;
  }
): Promise<ActionResult> {
  const session = await requireSession();
  const showCosts = canViewCosts(session.user.role);

  const parsed = saveLinesSchema.safeParse(rawLines);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Líneas inválidas" };
  }
  const lines = parsed.data;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lines: true },
  });
  if (!quote) return { ok: false, error: "Cotización no encontrada" };
  if (!EDITABLE_STATUSES.includes(quote.status as QuoteStatus)) {
    return {
      ok: false,
      error: "Esta cotización ya no es editable. Crea una nueva versión para modificarla.",
    };
  }

  // Productos referenciados — para validar precio de lista y resolver costos
  const productIds = [...new Set(lines.map((l) => l.productId).filter((p): p is string => !!p))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const prevById = new Map(quote.lines.map((l) => [l.id, l]));

  try {
    const rows = lines.map((l, idx) => {
      const product = l.productId ? productMap.get(l.productId) : undefined;
      if (l.productId && !product) throw new Error(`Producto no encontrado en la línea "${l.description}"`);

      // Precio de lista siempre desde el servidor (snapshot del producto)
      const listPrice = product ? product.listPrice : l.listPrice;

      // REGLA DE ORO: precio distinto a lista exige tipo + motivo (trazado con autor)
      let discountType: string | null = null;
      let discountReason: string | null = null;
      let discountAuthorId: string | null = null;
      if (isPriceOverride(l.unitPrice, listPrice)) {
        if (!l.discountType || !l.discountReason || l.discountReason.trim().length < 3) {
          throw new Error(
            `La línea "${l.description}" tiene precio distinto al de lista: indica tipo y motivo del precio especial.`
          );
        }
        discountType = l.discountType;
        discountReason = l.discountReason.trim();
        // Preserva el autor original si el override ya existía sin cambios de precio
        const prev = l.id ? prevById.get(l.id) : undefined;
        discountAuthorId =
          prev &&
          round2(prev.unitPrice) === round2(l.unitPrice) &&
          prev.discountAuthorId
            ? prev.discountAuthorId
            : session.user.id;
      }

      // Costeo interno: los roles sin permiso no envían costos — se preservan
      // los existentes (por id) o se toman del producto.
      const prev = l.id ? prevById.get(l.id) : undefined;
      let unitCost: number | null;
      let costQuantity: number | null;
      let supplierId: string | null;
      if (showCosts) {
        unitCost = l.unitCost ?? null;
        costQuantity = l.costQuantity ?? null;
        supplierId = l.supplierId ?? product?.supplierId ?? null;
      } else if (prev) {
        unitCost = prev.unitCost;
        costQuantity = prev.costQuantity;
        supplierId = prev.supplierId;
      } else {
        unitCost = product?.cost ?? null;
        costQuantity = null;
        supplierId = product?.supplierId ?? null;
      }

      const calcLine = {
        section: l.section,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        isOptional: l.isOptional,
        taxExempt: l.taxExempt,
        unitCost,
        costQuantity,
      };

      return {
        // Conserva el id de las líneas existentes (estabilidad entre guardados
        // y preservación de costos/autor de descuento por id)
        ...(l.id && prevById.has(l.id) ? { id: l.id } : {}),
        quoteId,
        section: l.section,
        dayNumber: l.dayNumber,
        productId: l.productId,
        description: l.description.trim(),
        comment: l.comment?.trim() || null,
        listPrice,
        unitPrice: round2(l.unitPrice),
        quantity: l.quantity,
        unit: l.unit,
        subtotal: lineSubtotal(calcLine),
        isOptional: l.isOptional,
        // Traslados siempre exentos de IVA (regla de negocio)
        taxExempt: l.section === "TRASLADOS" ? true : l.taxExempt,
        sortOrder: idx,
        discountType,
        discountReason,
        discountAuthorId,
        supplierId,
        unitCost,
        costQuantity,
        totalCost: unitCost != null ? lineCost(calcLine) : null,
      };
    });

    // Descuento de gerencia: SOLO ADMIN/GERENTE lo controla. Un rol sin permiso
    // no puede aplicarlo ni alterarlo → se preserva el descuento ya guardado.
    const canDiscount = canApplyQuoteDiscount(session.user.role);
    let discountPct: number;
    let discountReason: string | null;
    let discountByName: string | null;
    if (canDiscount) {
      discountPct = Math.min(Math.max(meta?.discountPct ?? 0, 0), 100);
      if (discountPct > 0) {
        const reason = (meta?.discountReason ?? "").trim();
        if (reason.length < 3) {
          return { ok: false, error: "El descuento de gerencia requiere un motivo." };
        }
        discountReason = reason;
        discountByName = session.user.name ?? "Gerencia";
      } else {
        discountReason = null;
        discountByName = null;
      }
    } else {
      discountPct = quote.managerDiscountPct;
      discountReason = quote.managerDiscountReason;
      discountByName = quote.managerDiscountByName;
    }

    // Totales SIEMPRE en el servidor con el snapshot de parámetros de la cotización
    const totals = calcQuoteTotals(
      rows,
      {
        taxPct: quote.taxPct,
        taxEnabled: quote.taxEnabled,
        servicePct: quote.servicePct,
        serviceEnabled: quote.serviceEnabled,
        depositPct: quote.depositPct,
        depositEnabled: quote.depositEnabled,
        igtfPct: quote.igtfPct,
        igtfEnabled: quote.igtfEnabled,
      },
      discountPct
    );

    // ¿Es esta la versión vigente del presupuesto? Solo la vigente sincroniza
    // el valor estimado de la oportunidad (no una versión anterior superada).
    const base = quoteBaseNumber(quote.number);
    const newer = await prisma.quote.findFirst({
      where: {
        OR: [{ number: base }, { number: { startsWith: `${base}-V` } }],
        version: { gt: quote.version },
      },
      select: { id: true },
    });
    const isLatest = !newer;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.quoteLine.deleteMany({ where: { quoteId } }),
      prisma.quoteLine.createMany({ data: rows }),
      prisma.quote.update({
        where: { id: quoteId },
        data: {
          subtotalMisc: totals.subtotalMisc,
          subtotalTransfers: totals.subtotalTransfers,
          subtotalFood: totals.subtotalFood,
          subtotalSpaces: totals.subtotalSpaces,
          serviceAmount: totals.serviceAmount,
          taxAmount: totals.taxAmount,
          totalUsd: totals.totalUsd,
          depositAmount: totals.depositAmount,
          managerDiscountPct: discountPct,
          managerDiscountReason: discountReason,
          managerDiscountByName: discountByName,
          discountAmount: totals.discountAmount,
          ...(meta
            ? { rateUsed: meta.rateUsed, rateKind: meta.rateKind }
            : {}),
        },
      }),
    ];
    if (isLatest) {
      // El valor estimado de la oportunidad sigue al total de la cotización vigente
      ops.push(
        prisma.opportunity.update({
          where: { id: quote.opportunityId },
          data: { estimatedValue: totals.totalUsd },
        })
      );
    }
    await prisma.$transaction(ops);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudieron guardar las líneas";
    return { ok: false, error: msg };
  }

  revalidateQuotePaths(quoteId);
  return { ok: true };
}

// ─────────────────────────── Cambios de estado ───────────────────────────

// Cualquier estado puede pasar a cualquier otro: a veces la cotización se crea
// y se aprueba/contrata de una vez (el cliente ya la había aceptado). El único
// guard de negocio que se mantiene es REQUIRES_CONTENT (no aprobar/enviar una
// cotización vacía) y la cascada de "ganada" al aprobar/contratar.
const ALLOWED_TRANSITIONS: Record<string, QuoteStatus[]> = Object.fromEntries(
  QUOTE_STATUSES.map((target) => [target, QUOTE_STATUSES.filter((s) => s !== target)])
) as Record<string, QuoteStatus[]>;

const STATUS_ACTIVITY: Record<string, string> = {
  ENVIADA: "marcada como enviada al cliente",
  APROBADA: "aprobada por el cliente",
  RECHAZADA: "rechazada por el cliente",
  CONTRATADA: "contratada — evento confirmado",
  VENCIDA: "marcada como vencida",
};

export async function changeQuoteStatus(
  quoteId: string,
  newStatus: string,
  note?: string
): Promise<ActionResult> {
  const session = await requireSession();

  if (!QUOTE_STATUSES.includes(newStatus as QuoteStatus)) {
    return { ok: false, error: "Estado inválido" };
  }
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { opportunity: true, event: true, _count: { select: { lines: true } } },
  });
  if (!quote) return { ok: false, error: "Cotización no encontrada" };

  const allowedFrom = ALLOWED_TRANSITIONS[newStatus] ?? [];
  if (!allowedFrom.includes(quote.status as QuoteStatus)) {
    return {
      ok: false,
      error: `No se puede pasar de "${quote.status}" a "${newStatus}"`,
    };
  }

  // No se envía/aprueba/contrata una cotización vacía: mandar un presupuesto sin
  // ítems al cliente no tiene sentido (y dejaba registros ENVIADA con total 0).
  const REQUIRES_CONTENT = ["ENVIADA", "APROBADA", "CONTRATADA"];
  if (REQUIRES_CONTENT.includes(newStatus) && quote._count.lines === 0) {
    return {
      ok: false,
      error: "La cotización no tiene líneas. Agregá al menos un ítem antes de enviarla o aprobarla.",
    };
  }

  try {
    const data: Prisma.QuoteUpdateInput = { status: newStatus };
    // Aprobar o contratar = oportunidad ganada: dispara la cascada de cierre.
    const isWon = newStatus === "APROBADA" || newStatus === "CONTRATADA";

    if (newStatus === "ENVIADA") {
      // Regenera vigencia al enviar
      const params = await getCommercialParams();
      data.validUntil = addDays(new Date(), params.quoteValidityDays);
    }
    if (newStatus === "APROBADA") {
      data.approvedAt = new Date();
      if (note?.trim()) data.approvedByName = note.trim();
    }
    if (newStatus === "RECHAZADA" && note?.trim()) {
      data.rejectionNote = note.trim();
    }
    if (newStatus === "CONTRATADA") {
      data.agreementDate = new Date();
    }

    // Cambio de estado + actividades + ascenso de la oportunidad: atómico.
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.quote.update({ where: { id: quoteId }, data }),
      prisma.activity.create({
        data: {
          userId: session.user.id,
          opportunityId: quote.opportunityId,
          quoteId,
          type: "SISTEMA",
          body: `Cotización ${quoteBaseNumber(quote.number)} v${quote.version} ${
            STATUS_ACTIVITY[newStatus] ?? `cambiada a ${newStatus}`
          }${note?.trim() ? ` — ${note.trim()}` : ""}`,
        },
      }),
    ];
    if (isWon && quote.opportunity.stage !== "GANADO") {
      const verbo = newStatus === "APROBADA" ? "aprobar" : "contratar";
      ops.push(
        prisma.opportunity.update({
          where: { id: quote.opportunityId },
          data: { stage: "GANADO", probability: STAGE_DEFAULT_PROBABILITY.GANADO },
        }),
        prisma.activity.create({
          data: {
            userId: session.user.id,
            opportunityId: quote.opportunityId,
            type: "CAMBIO_ETAPA",
            body: `Oportunidad movida a Ganado al ${verbo} la cotización ${quoteBaseNumber(quote.number)}`,
          },
        })
      );
    }
    // La fecha del evento deja de ser tentativa al cerrar.
    if (isWon && quote.eventId && quote.event?.datesTentative) {
      ops.push(
        prisma.event.update({
          where: { id: quote.eventId },
          data: { datesTentative: false },
        })
      );
    }
    await prisma.$transaction(ops);

    if (isWon) {
      // Promueve a CONFIRMADA las reservas de la cotización (tentativas hechas
      // al cotizar + líneas de ESPACIOS resueltas por Product.spaceId).
      try {
        await promoteQuoteReservations(quoteId, {
          id: session.user.id,
          name: session.user.name,
        });
      } catch (err) {
        console.error("promoteQuoteReservations", err);
      }
    }
    if (newStatus === "RECHAZADA" || newStatus === "VENCIDA") {
      // Aviso al ejecutivo para que decida liberar el/los salón(es) reservado(s).
      try {
        await notifyReleaseQuoteReservations(
          quoteId,
          newStatus === "RECHAZADA" ? "cotización rechazada" : "cotización vencida"
        );
      } catch (err) {
        console.error("notifyReleaseQuoteReservations", err);
      }
    }
  } catch (e) {
    console.error("changeQuoteStatus", e);
    return { ok: false, error: "No se pudo cambiar el estado" };
  }

  revalidateQuotePaths(quoteId);
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
  return { ok: true };
}

// ─────────────────────────── Nueva versión ───────────────────────────

export async function createNewVersion(quoteId: string): Promise<{ ok: false; error: string }> {
  const session = await requireSession();

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) return { ok: false, error: "Cotización no encontrada" };

  const base = quoteBaseNumber(quote.number);
  // La versión más alta existente de este número
  const siblings = await prisma.quote.findMany({
    where: { OR: [{ number: base }, { number: { startsWith: `${base}-V` } }] },
    select: { version: true },
  });
  const nextVersion = Math.max(...siblings.map((s) => s.version), quote.version) + 1;

  let newId: string;
  try {
    const params = await getCommercialParams();
    newId = await prisma.$transaction(async (tx) => {
      const clone = await tx.quote.create({
      data: {
        number: `${base}-V${nextVersion}`,
        version: nextVersion,
        opportunityId: quote.opportunityId,
        eventId: quote.eventId,
        signerId: session.user.id,
        status: "BORRADOR",
        publicToken: nanoid(12),
        issueDate: new Date(),
        validUntil: addDays(new Date(), params.quoteValidityDays),
        clientMessage: quote.clientMessage,
        legalConditions: quote.legalConditions,
        taxPct: quote.taxPct,
        taxEnabled: quote.taxEnabled,
        servicePct: quote.servicePct,
        serviceEnabled: quote.serviceEnabled,
        depositPct: quote.depositPct,
        depositEnabled: quote.depositEnabled,
        igtfPct: quote.igtfPct,
        igtfEnabled: quote.igtfEnabled,
        subtotalMisc: quote.subtotalMisc,
        subtotalTransfers: quote.subtotalTransfers,
        subtotalFood: quote.subtotalFood,
        subtotalSpaces: quote.subtotalSpaces,
        serviceAmount: quote.serviceAmount,
        taxAmount: quote.taxAmount,
        totalUsd: quote.totalUsd,
        depositAmount: quote.depositAmount,
        lines: {
          create: quote.lines.map((l) => ({
            section: l.section,
            dayNumber: l.dayNumber,
            productId: l.productId,
            description: l.description,
            comment: l.comment,
            listPrice: l.listPrice,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            unit: l.unit,
            subtotal: l.subtotal,
            isOptional: l.isOptional,
            taxExempt: l.taxExempt,
            sortOrder: l.sortOrder,
            discountType: l.discountType,
            discountReason: l.discountReason,
            discountAuthorId: l.discountAuthorId,
            supplierId: l.supplierId,
            unitCost: l.unitCost,
            costQuantity: l.costQuantity,
            totalCost: l.totalCost,
          })),
        },
      },
    });

      // Invalidar las versiones anteriores "vivas" (no contratadas ni rechazadas):
      // pasan a VENCIDA → dejan de ser editables, su link público deja de aceptar
      // aprobaciones y salen de los agregados financieros (CxC/reportes filtran por estado).
      const superseded = await tx.quote.updateMany({
        where: {
          OR: [{ number: base }, { number: { startsWith: `${base}-V` } }],
          id: { not: clone.id },
          status: { in: ["BORRADOR", "ENVIADA", "APROBADA"] },
        },
        data: { status: "VENCIDA" },
      });

      await tx.activity.create({
        data: {
          userId: session.user.id,
          opportunityId: quote.opportunityId,
          quoteId: clone.id,
          type: "SISTEMA",
          body:
            `Nueva versión v${nextVersion} de la cotización ${base} (a partir de v${quote.version}).` +
            (superseded.count > 0
              ? ` ${superseded.count} versión(es) anterior(es) marcada(s) como vencida(s).`
              : ""),
        },
      });

      return clone.id;
    });
  } catch (e) {
    console.error("createNewVersion", e);
    return { ok: false, error: "No se pudo crear la nueva versión" };
  }

  revalidateQuotePaths(quoteId);
  redirect(`/cotizaciones/${newId}/editar`);
}

// ─────────────────────────── Borrar cotización ───────────────────────────

// Solo se borra lo que no tiene plata atada. Pagos/facturas/imputaciones lo
// bloquean (son registros financieros). Estados cerrados (Aprobada/Contratada)
// tampoco: esos ya cerraron la oportunidad.
const DELETABLE_STATUSES: QuoteStatus[] = ["BORRADOR", "ENVIADA", "VENCIDA", "RECHAZADA"];

export async function deleteQuote(quoteId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!canDeleteQuotes(session.user.role)) {
    return { ok: false, error: "No tenés permiso para borrar cotizaciones." };
  }

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      number: true,
      version: true,
      status: true,
      opportunityId: true,
      _count: { select: { payments: true, invoices: true, allocations: true } },
    },
  });
  if (!quote) return { ok: false, error: "Cotización no encontrada" };

  if (!DELETABLE_STATUSES.includes(quote.status as QuoteStatus)) {
    return {
      ok: false,
      error: `No se puede borrar una cotización ${quote.status.toLowerCase()}. Solo borradores, enviadas, vencidas o rechazadas.`,
    };
  }
  if (quote._count.payments > 0 || quote._count.invoices > 0 || quote._count.allocations > 0) {
    return {
      ok: false,
      error: "No se puede borrar: la cotización tiene pagos o facturas asociados. Anulalos primero.",
    };
  }

  const opportunityId = quote.opportunityId;

  try {
    await prisma.$transaction(async (tx) => {
      // Reservas de salón originadas por la cotización: la FK es SetNull, así que
      // sin esto quedarían huérfanas ocupando el calendario. En estos estados son
      // tentativas, se sueltan.
      await tx.spaceReservation.deleteMany({ where: { quoteId } });
      // Borra la cotización: líneas, cuotas y actividades caen en cascada.
      await tx.quote.delete({ where: { id: quoteId } });
      // Deja rastro en el historial de la oportunidad (la cotización ya no existe).
      await tx.activity.create({
        data: {
          userId: session.user.id,
          opportunityId,
          type: "SISTEMA",
          body: `Cotización ${quote.number} (v${quote.version}) eliminada por ${session.user.name ?? "un usuario"}.`,
        },
      });
      // Resincroniza el valor estimado de la oportunidad con su cotización
      // vigente restante (mismo criterio que al guardar líneas).
      const remaining = await tx.quote.findFirst({
        where: { opportunityId },
        orderBy: [{ issueDate: "desc" }, { version: "desc" }],
        select: { totalUsd: true },
      });
      if (remaining) {
        await tx.opportunity.update({
          where: { id: opportunityId },
          data: { estimatedValue: remaining.totalUsd },
        });
      }
    });
  } catch (e) {
    console.error("deleteQuote", e);
    return { ok: false, error: "No se pudo borrar la cotización. Intenta de nuevo." };
  }

  revalidatePath("/cotizaciones");
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
  revalidatePath("/clientes");
  revalidatePath("/");
  return { ok: true };
}

// ─────────────────────── Comentario del cliente (link público) ───────────────────────

/** Marca como LEÍDO el comentario que dejó el cliente desde el link público. */
export async function markQuoteCommentRead(quoteId: string): Promise<ActionResult> {
  await requireSession();
  await prisma.quote.updateMany({
    where: { id: quoteId, commentUnread: true },
    data: { commentUnread: false },
  });
  revalidatePath("/cotizaciones");
  return { ok: true };
}
