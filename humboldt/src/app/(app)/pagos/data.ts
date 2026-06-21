// Consultas y serializadores del módulo Pagos (solo servidor).

import { prisma } from "@/lib/prisma";
import { round2, fmtUsd, bsToUsd } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  GARANTIA_APLICACION_MARKER,
  GARANTIA_DEVOLUCION_MARKER,
  type CxcRow,
  type InstallmentDTO,
  type InvoiceRow,
  type PaymentRow,
  type TargetOption,
} from "./types";
import type { BankAccountOption } from "./_components/payment-dialog";

type PaymentLite = {
  id: string;
  type: string;
  amountUsd: number;
  notes: string | null;
  date: Date;
  method: string;
  installmentId: string | null;
};

/** ¿El pago es un movimiento de garantía (no cuenta contra el precio)? */
export function isGarantiaMovement(p: { type: string; notes: string | null }): boolean {
  if (p.type === "GARANTIA") return true;
  return (
    p.type === "REINTEGRO" &&
    Boolean(
      p.notes?.includes(GARANTIA_DEVOLUCION_MARKER) ||
        p.notes?.includes(GARANTIA_APLICACION_MARKER)
    )
  );
}

/** Suma pagada contra el precio (abonos, anticipos y reintegros genéricos). */
export function sumPagado(payments: PaymentLite[]): number {
  return round2(
    payments
      .filter((p) => !isGarantiaMovement(p))
      .reduce((s, p) => s + p.amountUsd, 0)
  );
}

/** Garantía neta en custodia (recibida − devuelta − aplicada). */
export function sumGarantiaCustodia(payments: PaymentLite[]): number {
  return round2(
    payments
      .filter((p) => isGarantiaMovement(p))
      .reduce((s, p) => s + p.amountUsd, 0)
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Cuentas por cobrar ───────────────────────────────────────────────

export async function getCxcRows(): Promise<CxcRow[]> {
  const quotes = await prisma.quote.findMany({
    where: { status: { in: ["APROBADA", "CONTRATADA"] } },
    include: {
      opportunity: { include: { client: true } },
      payments: true,
      installments: { include: { payments: true }, orderBy: { dueDate: "asc" } },
      invoices: { include: { retentions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const today = startOfToday();

  return quotes.map((q) => {
    const pagado = sumPagado(q.payments);
    const garantiaRecibida = round2(
      q.payments.filter((p) => p.type === "GARANTIA").reduce((s, p) => s + p.amountUsd, 0)
    );
    const retencionesUsd = round2(
      q.invoices
        .filter((inv) => inv.status !== "ANULADA")
        .flatMap((inv) =>
          inv.retentions
            .filter((r) => r.countsAsPayment)
            .map((r) => (inv.rateUsed ? bsToUsd(r.amountBs, inv.rateUsed) : 0))
        )
        .reduce((s, v) => s + v, 0)
    );
    const saldo = round2(q.totalUsd - pagado - retencionesUsd);

    const installments: InstallmentDTO[] = q.installments.map((i) => ({
      id: i.id,
      label: i.label,
      dueDate: i.dueDate.toISOString(),
      amount: i.amount,
      status: i.status,
      paidUsd: round2(i.payments.reduce((s, p) => s + p.amountUsd, 0)),
    }));

    const pendientes = q.installments.filter((i) => i.status !== "PAGADA");
    const hasOverdue = saldo > 0.01 && pendientes.some((i) => i.dueDate < today);
    const next = pendientes[0] ?? null;

    const unassignedPayments = q.payments
      .filter((p) => !p.installmentId && !isGarantiaMovement(p))
      .map((p) => ({
        id: p.id,
        label: `${format(p.date, "dd/MM/yyyy", { locale: es })} · ${fmtUsd(p.amountUsd)} · ${
          PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method
        }`,
        amountUsd: p.amountUsd,
      }));

    return {
      quoteId: q.id,
      number: q.number,
      status: q.status,
      clientName: q.opportunity.client.brandName || q.opportunity.client.legalName,
      opportunityId: q.opportunityId,
      opportunityTitle: q.opportunity.title,
      totalUsd: q.totalUsd,
      depositAmount: q.depositAmount,
      garantiaRecibida,
      pagado,
      retencionesUsd,
      saldo,
      hasOverdue,
      nextInstallment: next
        ? {
            label: next.label,
            dueDate: next.dueDate.toISOString(),
            amount: next.amount,
            overdue: next.dueDate < today,
          }
        : null,
      installments,
      unassignedPayments,
    };
  });
}

// ── Pagos registrados ────────────────────────────────────────────────

export async function getPaymentRows(): Promise<PaymentRow[]> {
  const payments = await prisma.payment.findMany({
    include: {
      opportunity: { include: { client: true } },
      quote: true,
      installment: true,
    },
    orderBy: { date: "desc" },
  });

  return payments.map((p) => ({
    id: p.id,
    date: p.date.toISOString(),
    clientName: p.opportunity.client.brandName || p.opportunity.client.legalName,
    opportunityId: p.opportunityId,
    opportunityTitle: p.opportunity.title,
    quoteNumber: p.quote?.number ?? null,
    installmentLabel: p.installment?.label ?? null,
    method: p.method,
    type: p.type,
    currency: p.currency,
    amountOriginal: p.amountOriginal,
    rateUsed: p.rateUsed,
    amountUsd: p.amountUsd,
    reference: p.reference,
    notes: p.notes,
  }));
}

// ── Facturas ─────────────────────────────────────────────────────────

export async function getInvoiceRows(): Promise<InvoiceRow[]> {
  const invoices = await prisma.invoice.findMany({
    include: {
      opportunity: { include: { client: true } },
      quote: true,
      retentions: true,
    },
    orderBy: { date: "desc" },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    date: inv.date.toISOString(),
    clientName: inv.opportunity.client.brandName || inv.opportunity.client.legalName,
    opportunityId: inv.opportunityId,
    opportunityTitle: inv.opportunity.title,
    quoteNumber: inv.quote?.number ?? null,
    type: inv.type,
    amountBs: inv.amountBs,
    amountUsdRef: inv.amountUsdRef,
    rateUsed: inv.rateUsed,
    status: inv.status,
    retentions: inv.retentions.map((r) => ({
      id: r.id,
      type: r.type,
      amountBs: r.amountBs,
    })),
  }));
}

// ── Opciones del combobox cotización/oportunidad ─────────────────────

export async function getTargetOptions(opportunityId?: string): Promise<TargetOption[]> {
  const quotes = await prisma.quote.findMany({
    where: {
      status: { in: ["APROBADA", "CONTRATADA"] },
      ...(opportunityId ? { opportunityId } : {}),
    },
    include: {
      opportunity: { include: { client: true } },
      installments: { include: { payments: true }, orderBy: { dueDate: "asc" } },
    },
    orderBy: { number: "desc" },
  });

  const quotedOppIds = new Set(quotes.map((q) => q.opportunityId));

  const opportunities = await prisma.opportunity.findMany({
    where: {
      stage: { not: "PERDIDO" },
      ...(opportunityId ? { id: opportunityId } : {}),
    },
    include: { client: true },
    orderBy: { code: "desc" },
  });

  const quoteOptions: TargetOption[] = quotes.map((q) => ({
    value: `Q:${q.id}`,
    kind: "QUOTE",
    quoteId: q.id,
    opportunityId: q.opportunityId,
    label: `${q.number} · ${q.opportunity.client.brandName || q.opportunity.client.legalName}`,
    sublabel: q.opportunity.title,
    totalUsd: q.totalUsd,
    installments: q.installments.map((i) => ({
      id: i.id,
      label: i.label,
      dueDate: i.dueDate.toISOString(),
      amount: i.amount,
      status: i.status,
      paidUsd: round2(i.payments.reduce((s, p) => s + p.amountUsd, 0)),
    })),
  }));

  const oppOptions: TargetOption[] = opportunities
    .filter((o) => !quotedOppIds.has(o.id))
    .map((o) => ({
      value: `O:${o.id}`,
      kind: "OPP",
      quoteId: null,
      opportunityId: o.id,
      label: `${o.code} · ${o.client.brandName || o.client.legalName}`,
      sublabel: o.title,
      totalUsd: null,
      installments: [],
    }));

  return [...quoteOptions, ...oppOptions];
}

/** Cuentas bancarias activas para asignar al registrar un pago (conciliación). */
export async function getBankAccountOptions(): Promise<BankAccountOption[]> {
  return prisma.bankAccount.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, currency: true, type: true },
  });
}
