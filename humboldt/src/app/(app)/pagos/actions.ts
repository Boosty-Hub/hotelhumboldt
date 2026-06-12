"use server";

// Server actions del módulo Pagos y Cobranza.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { round2, bsToUsd } from "@/lib/money";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";
import {
  ALLOCATION_BUCKETS,
  INVOICE_TYPES,
  RETENTION_TYPES,
  GARANTIA_DEVOLUCION_MARKER,
  GARANTIA_APLICACION_MARKER,
} from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

// ── Helpers ──────────────────────────────────────────────────────────

/** "2026-06-12" → Date al mediodía local (evita corrimientos de día por TZ). */
function parseDateInput(s: string): Date {
  return new Date(`${s}T12:00:00`);
}

function zodError(err: z.ZodError): string {
  const first = err.issues[0];
  return first ? first.message : "Datos inválidos";
}

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("NO_AUTH");
  return session;
}

/** Recalcula el estado de una cuota según los pagos asociados. */
async function recomputeInstallmentStatus(installmentId: string) {
  const inst = await prisma.paymentInstallment.findUnique({
    where: { id: installmentId },
    include: { payments: true },
  });
  if (!inst) return;
  const paid = round2(inst.payments.reduce((s, p) => s + p.amountUsd, 0));
  const status =
    paid >= round2(inst.amount) - 0.01
      ? "PAGADA"
      : paid > 0
        ? "PARCIAL"
        : "PENDIENTE";
  if (status !== inst.status) {
    await prisma.paymentInstallment.update({
      where: { id: inst.id },
      data: { status },
    });
  }
}

function revalidatePagos(opportunityId?: string) {
  revalidatePath("/pagos");
  if (opportunityId) revalidatePath(`/pagos/oportunidad/${opportunityId}`);
}

// ── Registrar pago ───────────────────────────────────────────────────

const allocationSchema = z.object({
  bucket: z.enum(ALLOCATION_BUCKETS, { message: "Sección de imputación inválida" }),
  amount: z
    .number({ message: "Monto de imputación inválido" })
    .positive("Cada imputación debe ser mayor a 0"),
});

const pagoSchema = z
  .object({
    opportunityId: z.string().min(1, "Selecciona una cotización u oportunidad"),
    quoteId: z.string().nullable().optional(),
    installmentId: z.string().nullable().optional(),
    type: z.enum(PAYMENT_TYPES, { message: "Tipo de pago inválido" }),
    method: z.enum(PAYMENT_METHODS, { message: "Método de pago inválido" }),
    currency: z.enum(["USD", "BS"], { message: "Moneda inválida" }),
    amount: z
      .number({ message: "Indica el monto del pago" })
      .positive("El monto debe ser mayor a 0"),
    rate: z.number().positive("La tasa debe ser mayor a 0").nullable().optional(),
    date: z.string().min(1, "Indica la fecha del pago"),
    reference: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    allocations: z.array(allocationSchema).nullable().optional(),
  })
  .refine((d) => d.currency !== "BS" || (d.rate != null && d.rate > 0), {
    message: "Para pagos en bolívares debes indicar la tasa Bs/USD",
  });

export async function registrarPago(input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = pagoSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: zodError(parsed.error) };
    const d = parsed.data;

    // Verificar oportunidad y cotización
    const opp = await prisma.opportunity.findUnique({ where: { id: d.opportunityId } });
    if (!opp) return { ok: false, error: "La oportunidad seleccionada no existe" };
    if (d.quoteId) {
      const quote = await prisma.quote.findUnique({ where: { id: d.quoteId } });
      if (!quote || quote.opportunityId !== d.opportunityId)
        return { ok: false, error: "La cotización no corresponde a la oportunidad" };
    }

    // La cuota debe existir y pertenecer a la cotización/oportunidad del pago
    if (d.installmentId) {
      const inst = await prisma.paymentInstallment.findUnique({
        where: { id: d.installmentId },
        include: { quote: { select: { opportunityId: true } } },
      });
      if (!inst) return { ok: false, error: "La cuota seleccionada no existe" };
      if (d.quoteId && inst.quoteId !== d.quoteId)
        return { ok: false, error: "La cuota no corresponde a la cotización" };
      if (inst.quote.opportunityId !== d.opportunityId)
        return { ok: false, error: "La cuota no corresponde a la oportunidad" };
    }

    // Equivalente USD
    const usd =
      d.currency === "BS" ? bsToUsd(d.amount, d.rate as number) : round2(d.amount);
    if (usd <= 0) return { ok: false, error: "El equivalente en USD debe ser mayor a 0" };

    // REINTEGRO se registra en negativo (sale dinero)
    const sign = d.type === "REINTEGRO" ? -1 : 1;

    // Imputación por secciones (requiere cotización y debe cuadrar con el total)
    let allocations = d.allocations ?? [];
    if (allocations.length > 0) {
      if (!d.quoteId)
        return { ok: false, error: "La imputación por secciones requiere una cotización" };
      const sum = round2(allocations.reduce((s, a) => s + a.amount, 0));
      if (Math.abs(sum - usd) > 0.01)
        return {
          ok: false,
          error: `La imputación (${sum.toFixed(2)}) debe sumar el equivalente USD del pago (${usd.toFixed(2)})`,
        };
      allocations = allocations.map((a) => ({ ...a, amount: round2(sign * a.amount) }));
    }

    await prisma.payment.create({
      data: {
        opportunityId: d.opportunityId,
        quoteId: d.quoteId ?? null,
        installmentId: d.installmentId ?? null,
        date: parseDateInput(d.date),
        method: d.method,
        currency: d.currency,
        amountOriginal: round2(sign * d.amount),
        rateUsed: d.currency === "BS" ? d.rate : null,
        amountUsd: round2(sign * usd),
        type: d.type,
        reference: d.reference?.trim() || null,
        notes: d.notes?.trim() || null,
        ...(d.quoteId
          ? {
              allocations: {
                create:
                  allocations.length > 0
                    ? allocations.map((a) => ({
                        quoteId: d.quoteId as string,
                        bucket: a.bucket,
                        amount: a.amount,
                      }))
                    : [
                        {
                          quoteId: d.quoteId,
                          bucket: d.type === "GARANTIA" ? "GARANTIA" : "GENERAL",
                          amount: round2(sign * usd),
                        },
                      ],
              },
            }
          : {}),
      },
    });

    if (d.installmentId) await recomputeInstallmentStatus(d.installmentId);

    revalidatePagos(d.opportunityId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NO_AUTH")
      return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
    console.error("registrarPago", e);
    return { ok: false, error: "No se pudo registrar el pago. Intenta de nuevo." };
  }
}

// ── Registrar factura ────────────────────────────────────────────────

const retencionSchema = z.object({
  type: z.enum(RETENTION_TYPES, { message: "Tipo de retención inválido" }),
  amountBs: z
    .number({ message: "Monto de retención inválido" })
    .positive("La retención debe ser mayor a 0"),
});

const facturaSchema = z.object({
  opportunityId: z.string().min(1, "Selecciona una cotización u oportunidad"),
  quoteId: z.string().nullable().optional(),
  number: z.string().min(1, "Indica el número de factura"),
  date: z.string().min(1, "Indica la fecha de la factura"),
  type: z.enum(INVOICE_TYPES, { message: "Tipo de factura inválido" }),
  amountBs: z
    .number({ message: "Indica el monto en bolívares" })
    .positive("El monto en Bs debe ser mayor a 0"),
  rate: z
    .number({ message: "Indica la tasa Bs/USD" })
    .positive("La tasa debe ser mayor a 0"),
  notes: z.string().nullable().optional(),
  retentions: z.array(retencionSchema).nullable().optional(),
});

export async function registrarFactura(input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = facturaSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: zodError(parsed.error) };
    const d = parsed.data;

    const opp = await prisma.opportunity.findUnique({ where: { id: d.opportunityId } });
    if (!opp) return { ok: false, error: "La oportunidad seleccionada no existe" };
    if (d.quoteId) {
      const quote = await prisma.quote.findUnique({ where: { id: d.quoteId } });
      if (!quote || quote.opportunityId !== d.opportunityId)
        return { ok: false, error: "La cotización no corresponde a la oportunidad" };
    }

    const duplicated = await prisma.invoice.findFirst({
      where: { number: d.number.trim(), type: d.type },
    });
    if (duplicated)
      return { ok: false, error: `Ya existe una factura ${d.number.trim()} de ese tipo` };

    const retentions = d.retentions ?? [];

    await prisma.invoice.create({
      data: {
        number: d.number.trim(),
        date: parseDateInput(d.date),
        opportunityId: d.opportunityId,
        quoteId: d.quoteId ?? null,
        type: d.type,
        amountBs: round2(d.amountBs),
        amountUsdRef: bsToUsd(d.amountBs, d.rate),
        rateUsed: d.rate,
        status: "EMITIDA",
        notes: d.notes?.trim() || null,
        retentions: {
          create: retentions.map((r) => ({
            type: r.type,
            amountBs: round2(r.amountBs),
            countsAsPayment: true,
          })),
        },
      },
    });

    revalidatePagos(d.opportunityId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NO_AUTH")
      return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
    console.error("registrarFactura", e);
    return { ok: false, error: "No se pudo registrar la factura. Intenta de nuevo." };
  }
}

// ── Plan de cuotas ───────────────────────────────────────────────────

const cuotaSchema = z.object({
  id: z.string().nullable().optional(),
  label: z.string().min(1, "Cada cuota necesita una descripción"),
  dueDate: z.string().min(1, "Cada cuota necesita fecha de vencimiento"),
  amount: z
    .number({ message: "Monto de cuota inválido" })
    .positive("El monto de cada cuota debe ser mayor a 0"),
});

const planSchema = z.object({
  quoteId: z.string().min(1, "Cotización inválida"),
  cuotas: z.array(cuotaSchema).min(1, "El plan debe tener al menos una cuota"),
});

export async function guardarPlanCuotas(input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: zodError(parsed.error) };
    const d = parsed.data;

    const quote = await prisma.quote.findUnique({
      where: { id: d.quoteId },
      include: { installments: { include: { payments: true } } },
    });
    if (!quote) return { ok: false, error: "La cotización no existe" };

    const incomingIds = new Set(d.cuotas.filter((c) => c.id).map((c) => c.id as string));

    // Las cuotas con pagos asociados no pueden eliminarse del plan
    for (const inst of quote.installments) {
      if (inst.payments.length > 0 && !incomingIds.has(inst.id)) {
        return {
          ok: false,
          error: `La cuota "${inst.label}" tiene pagos asociados y no puede eliminarse`,
        };
      }
    }

    const existingIds = new Set(quote.installments.map((i) => i.id));

    await prisma.$transaction(async (tx) => {
      // Eliminar las que salieron del plan (sin pagos)
      const toDelete = quote.installments
        .filter((i) => i.payments.length === 0 && !incomingIds.has(i.id))
        .map((i) => i.id);
      if (toDelete.length > 0) {
        await tx.paymentInstallment.deleteMany({ where: { id: { in: toDelete } } });
      }
      // Actualizar / crear
      for (const c of d.cuotas) {
        if (c.id && existingIds.has(c.id)) {
          await tx.paymentInstallment.update({
            where: { id: c.id },
            data: {
              label: c.label.trim(),
              dueDate: parseDateInput(c.dueDate),
              amount: round2(c.amount),
            },
          });
        } else {
          await tx.paymentInstallment.create({
            data: {
              quoteId: d.quoteId,
              label: c.label.trim(),
              dueDate: parseDateInput(c.dueDate),
              amount: round2(c.amount),
              status: "PENDIENTE",
            },
          });
        }
      }
    });

    // Recalcular estados de cuotas que permanecen
    for (const id of incomingIds) await recomputeInstallmentStatus(id);

    revalidatePagos(quote.opportunityId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NO_AUTH")
      return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
    console.error("guardarPlanCuotas", e);
    return { ok: false, error: "No se pudo guardar el plan de cuotas." };
  }
}

export async function eliminarCuota(installmentId: string): Promise<ActionResult> {
  try {
    await requireSession();
    const inst = await prisma.paymentInstallment.findUnique({
      where: { id: installmentId },
      include: { payments: true, quote: true },
    });
    if (!inst) return { ok: false, error: "La cuota no existe" };
    if (inst.payments.length > 0)
      return { ok: false, error: "La cuota tiene pagos asociados y no puede eliminarse" };

    await prisma.paymentInstallment.delete({ where: { id: installmentId } });
    revalidatePagos(inst.quote.opportunityId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NO_AUTH")
      return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
    console.error("eliminarCuota", e);
    return { ok: false, error: "No se pudo eliminar la cuota." };
  }
}

export async function asociarPagoACuota(
  paymentId: string,
  installmentId: string | null
): Promise<ActionResult> {
  try {
    await requireSession();
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return { ok: false, error: "El pago no existe" };

    if (installmentId) {
      const inst = await prisma.paymentInstallment.findUnique({
        where: { id: installmentId },
      });
      if (!inst) return { ok: false, error: "La cuota no existe" };
      if (payment.quoteId && payment.quoteId !== inst.quoteId)
        return { ok: false, error: "El pago pertenece a otra cotización" };
    }

    const previousInstallmentId = payment.installmentId;
    await prisma.payment.update({
      where: { id: paymentId },
      data: { installmentId },
    });

    if (previousInstallmentId) await recomputeInstallmentStatus(previousInstallmentId);
    if (installmentId) await recomputeInstallmentStatus(installmentId);

    revalidatePagos(payment.opportunityId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NO_AUTH")
      return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
    console.error("asociarPagoACuota", e);
    return { ok: false, error: "No se pudo asociar el pago a la cuota." };
  }
}

// ── Movimientos de garantía (devolución / aplicación al saldo) ───────

const garantiaSchema = z.object({
  opportunityId: z.string().min(1, "Oportunidad inválida"),
  quoteId: z.string().nullable().optional(),
  mode: z.enum(["DEVOLUCION", "APLICACION"], { message: "Operación inválida" }),
  amount: z
    .number({ message: "Indica el monto" })
    .positive("El monto debe ser mayor a 0"),
  method: z.enum(PAYMENT_METHODS, { message: "Método inválido" }),
  date: z.string().min(1, "Indica la fecha"),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function registrarMovimientoGarantia(input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = garantiaSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: zodError(parsed.error) };
    const d = parsed.data;

    const opp = await prisma.opportunity.findUnique({ where: { id: d.opportunityId } });
    if (!opp) return { ok: false, error: "La oportunidad no existe" };

    // Garantía disponible en custodia
    const payments = await prisma.payment.findMany({
      where: { opportunityId: d.opportunityId },
    });
    const recibida = payments
      .filter((p) => p.type === "GARANTIA")
      .reduce((s, p) => s + p.amountUsd, 0);
    const salidas = payments
      .filter(
        (p) =>
          p.type === "REINTEGRO" &&
          (p.notes?.includes(GARANTIA_DEVOLUCION_MARKER) ||
            p.notes?.includes(GARANTIA_APLICACION_MARKER))
      )
      .reduce((s, p) => s + p.amountUsd, 0); // negativos
    const disponible = round2(recibida + salidas);

    if (round2(d.amount) > disponible + 0.01)
      return {
        ok: false,
        error: `Solo hay $${disponible.toFixed(2)} de garantía en custodia`,
      };

    const marker =
      d.mode === "DEVOLUCION" ? GARANTIA_DEVOLUCION_MARKER : GARANTIA_APLICACION_MARKER;
    const extraNotes = d.notes?.trim() ? ` ${d.notes.trim()}` : "";
    const date = parseDateInput(d.date);

    await prisma.$transaction(async (tx) => {
      // Salida de la garantía (REINTEGRO negativo)
      await tx.payment.create({
        data: {
          opportunityId: d.opportunityId,
          quoteId: d.quoteId ?? null,
          date,
          method: d.method,
          currency: "USD",
          amountOriginal: round2(-d.amount),
          amountUsd: round2(-d.amount),
          type: "REINTEGRO",
          reference: d.reference?.trim() || null,
          notes: `${marker}${extraNotes}`,
          ...(d.quoteId
            ? {
                allocations: {
                  create: [
                    { quoteId: d.quoteId, bucket: "GARANTIA", amount: round2(-d.amount) },
                  ],
                },
              }
            : {}),
        },
      });

      // Si se aplica al saldo, entra como abono al precio del evento
      if (d.mode === "APLICACION") {
        await tx.payment.create({
          data: {
            opportunityId: d.opportunityId,
            quoteId: d.quoteId ?? null,
            date,
            method: d.method,
            currency: "USD",
            amountOriginal: round2(d.amount),
            amountUsd: round2(d.amount),
            type: "ABONO",
            reference: d.reference?.trim() || null,
            notes: `${marker}${extraNotes}`,
            ...(d.quoteId
              ? {
                  allocations: {
                    create: [
                      { quoteId: d.quoteId, bucket: "GENERAL", amount: round2(d.amount) },
                    ],
                  },
                }
              : {}),
          },
        });
      }
    });

    revalidatePagos(d.opportunityId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NO_AUTH")
      return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
    console.error("registrarMovimientoGarantia", e);
    return { ok: false, error: "No se pudo registrar el movimiento de garantía." };
  }
}
