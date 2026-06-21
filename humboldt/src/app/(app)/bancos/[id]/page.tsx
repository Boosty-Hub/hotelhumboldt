import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Landmark } from "lucide-react";
import { auth, canViewCosts } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtUsd, round2 } from "@/lib/money";
import { BANK_ACCOUNT_TYPE_LABELS, type BankAccountType } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReconcileTable, type MovRow } from "./reconcile-table";

export const metadata = { title: "Conciliación de cuenta" };

export default async function CuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canViewCosts(session.user.role)) redirect("/");

  const account = await prisma.bankAccount.findUnique({
    where: { id },
    include: {
      payments: {
        orderBy: { date: "desc" },
        include: { opportunity: { include: { client: true } } },
      },
    },
  });
  if (!account) notFound();

  const rows: MovRow[] = account.payments.map((p) => ({
    id: p.id,
    date: p.date.toISOString(),
    amountOriginal: p.amountOriginal,
    currency: p.currency,
    amountUsd: p.amountUsd,
    method: p.method,
    type: p.type,
    reference: p.reference,
    reconciled: p.reconciled,
    clientName: p.opportunity.client.brandName ?? p.opportunity.client.legalName,
    oppCode: p.opportunity.code,
    oppId: p.opportunityId,
  }));

  const totalUsd = round2(account.payments.reduce((s, p) => s + p.amountUsd, 0));
  const pendientesUsd = round2(
    account.payments.filter((p) => !p.reconciled).reduce((s, p) => s + p.amountUsd, 0)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/bancos" aria-label="Volver a Bancos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Landmark className="size-5 shrink-0 text-sky-900" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">{account.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>{BANK_ACCOUNT_TYPE_LABELS[account.type as BankAccountType] ?? account.type}</span>
            <Badge variant="outline">{account.currency}</Badge>
            {account.bank && <span>· {account.bank}</span>}
            {account.accountNumber && <span>· {account.accountNumber}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-[11px] text-muted-foreground">Total recibido (USD)</p>
            <p className="text-lg font-bold tabular-nums">{fmtUsd(totalUsd)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-[11px] text-muted-foreground">Por conciliar (USD)</p>
            <p className="text-lg font-bold tabular-nums text-amber-700">{fmtUsd(pendientesUsd)}</p>
          </CardContent>
        </Card>
      </div>

      <ReconcileTable rows={rows} />
    </div>
  );
}
