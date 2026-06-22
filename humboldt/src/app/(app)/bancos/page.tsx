import { redirect } from "next/navigation";
import { auth, canViewCosts } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BankAccountsManager, type AccountRow } from "./_components/bank-accounts-manager";

export const metadata = { title: "Bancos" };

export default async function BancosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canViewCosts(session.user.role)) redirect("/"); // módulo de finanzas

  const accounts = await prisma.bankAccount.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const [totals, pend] = await Promise.all([
    prisma.payment.groupBy({ by: ["bankAccountId"], _count: { _all: true } }),
    prisma.payment.groupBy({
      by: ["bankAccountId"],
      where: { reconciled: false },
      _count: { _all: true },
    }),
  ]);
  const totalMap = new Map(totals.map((t) => [t.bankAccountId, t._count._all]));
  const pendMap = new Map(pend.map((t) => [t.bankAccountId, t._count._all]));

  const rows: AccountRow[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    bank: a.bank,
    accountNumber: a.accountNumber,
    phone: a.phone,
    documentId: a.documentId,
    currency: a.currency,
    type: a.type,
    active: a.active,
    movimientos: totalMap.get(a.id) ?? 0,
    pendientes: pendMap.get(a.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bancos</h1>
        <p className="text-sm text-muted-foreground">
          Cuentas de recepción y conciliación de los pagos recibidos.
        </p>
      </div>
      <BankAccountsManager accounts={rows} />
    </div>
  );
}
