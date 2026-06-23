"use server";

// Server actions del módulo Bancos — CRUD de cuentas de recepción y marcado de
// conciliación de pagos. Acceso: finanzas (ADMIN / GERENTE).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, canViewCosts } from "@/lib/auth";
import { BANK_ACCOUNT_TYPES, PAYMENT_METHODS, CURRENCY_METHODS } from "@/lib/constants";

export type BancoResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireFinance(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || !canViewCosts(session.user.role)) {
    return { ok: false, error: "No tenés permisos para gestionar bancos." };
  }
  return { ok: true, userId: session.user.id };
}

const accountSchema = z.object({
  name: z.string().trim().min(2, "El alias de la cuenta es obligatorio."),
  bank: z.string().trim().max(80).optional().or(z.literal("")),
  accountNumber: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  documentId: z.string().trim().max(40).optional().or(z.literal("")),
  currency: z.enum(["BS", "USD"], "Moneda inválida."),
  type: z.enum(BANK_ACCOUNT_TYPES, "Tipo de cuenta inválido."),
  methods: z
    .array(z.enum(PAYMENT_METHODS))
    .min(1, "Elegí al menos un método de pago para el banco."),
}).superRefine((d, ctx) => {
  // Los métodos deben ser coherentes con la moneda del banco.
  const allowed = CURRENCY_METHODS[d.currency];
  if (d.methods.some((m) => !allowed.includes(m))) {
    ctx.addIssue({
      code: "custom",
      message: `Hay métodos no compatibles con la moneda ${d.currency}.`,
      path: ["methods"],
    });
  }
});

export async function createBankAccount(input: {
  name: string;
  bank?: string;
  accountNumber?: string;
  phone?: string;
  documentId?: string;
  currency: string;
  type: string;
  methods?: string[];
}): Promise<BancoResult> {
  const guard = await requireFinance();
  if (!guard.ok) return guard;
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await prisma.bankAccount.create({
    data: {
      name: d.name,
      bank: d.bank || null,
      accountNumber: d.accountNumber || null,
      phone: d.phone || null,
      documentId: d.documentId || null,
      currency: d.currency,
      type: d.type,
      methods: d.methods,
    },
  });
  revalidatePath("/bancos");
  return { ok: true, message: `Cuenta «${d.name}» creada.` };
}

export async function updateBankAccount(input: {
  id: string;
  name: string;
  bank?: string;
  accountNumber?: string;
  phone?: string;
  documentId?: string;
  currency: string;
  type: string;
  methods?: string[];
}): Promise<BancoResult> {
  const guard = await requireFinance();
  if (!guard.ok) return guard;
  if (!input.id) return { ok: false, error: "Cuenta inválida." };
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  await prisma.bankAccount.update({
    where: { id: input.id },
    data: {
      name: d.name,
      bank: d.bank || null,
      accountNumber: d.accountNumber || null,
      phone: d.phone || null,
      documentId: d.documentId || null,
      currency: d.currency,
      type: d.type,
      methods: d.methods,
    },
  });
  revalidatePath("/bancos");
  revalidatePath(`/bancos/${input.id}`);
  return { ok: true, message: "Cuenta actualizada." };
}

export async function toggleBankAccountActive(input: {
  id: string;
  active: boolean;
}): Promise<BancoResult> {
  const guard = await requireFinance();
  if (!guard.ok) return guard;
  if (!input.id) return { ok: false, error: "Cuenta inválida." };
  await prisma.bankAccount.update({
    where: { id: input.id },
    data: { active: Boolean(input.active) },
  });
  revalidatePath("/bancos");
  return { ok: true, message: input.active ? "Cuenta activada." : "Cuenta desactivada." };
}

/** Marca/desmarca un pago como conciliado contra el banco. */
export async function setPaymentReconciled(input: {
  paymentId: string;
  reconciled: boolean;
}): Promise<BancoResult> {
  const guard = await requireFinance();
  if (!guard.ok) return guard;
  const pay = await prisma.payment.findUnique({ where: { id: input.paymentId } });
  if (!pay) return { ok: false, error: "El pago no existe." };
  await prisma.payment.update({
    where: { id: input.paymentId },
    data: {
      reconciled: Boolean(input.reconciled),
      reconciledAt: input.reconciled ? new Date() : null,
    },
  });
  revalidatePath("/bancos");
  if (pay.bankAccountId) revalidatePath(`/bancos/${pay.bankAccountId}`);
  return { ok: true, message: input.reconciled ? "Pago conciliado." : "Conciliación deshecha." };
}
