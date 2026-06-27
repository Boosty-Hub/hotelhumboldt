// Módulo Pagos y Cobranza — vista principal con tabs:
// Cuentas por cobrar · Pagos registrados · Facturas

import { redirect } from "next/navigation";
import { Banknote, FilePlus2, Landmark, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { getCurrentRate, getParallelRate } from "@/lib/bcv";
import { fmtUsd, fmtBs, fmtNum, round2 } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBankAccountOptions, getCobradoMesUsd, getCxcRows, getFacturadoBs, getInvoiceRows, getPaymentRows, getTargetOptions } from "./data";
import { PagosTabs } from "./_components/pagos-tabs";
import { PaymentDialog } from "./_components/payment-dialog";
import { InvoiceDialog } from "./_components/invoice-dialog";

export const metadata = { title: "Pagos y cobranza" };

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "cxc";

  const [
    cxcRows,
    paymentRows,
    invoiceRows,
    targets,
    rateInfo,
    parallelInfo,
    bankAccounts,
    cobradoMes,
    facturadoBs,
  ] = await Promise.all([
    getCxcRows(),
    getPaymentRows(),
    getInvoiceRows(),
    getTargetOptions(),
    getCurrentRate(),
    getParallelRate(),
    getBankAccountOptions(),
    getCobradoMesUsd(),
    getFacturadoBs(),
  ]);

  const defaultRate = rateInfo?.rate ?? null;
  const parallelRate = parallelInfo?.rate ?? null;

  // Indicadores
  const porCobrar = round2(
    cxcRows.reduce((s, r) => s + Math.max(r.saldo, 0), 0)
  );
  // `cobradoMes` y `facturadoBs` se calculan en SQL (ver data.ts) para no
  // recorrer toda la tabla de pagos/facturas en JS.
  const garantiasCustodia = round2(
    cxcRows.reduce((s, r) => s + r.garantiaRecibida, 0)
  );

  const kpis = [
    {
      label: "Por cobrar",
      value: fmtUsd(porCobrar),
      icon: Wallet,
      hint: `${cxcRows.filter((r) => r.saldo > 0.01).length} cotizaciones con saldo`,
    },
    {
      label: "Cobrado este mes",
      value: fmtUsd(cobradoMes),
      icon: TrendingUp,
      hint: "Abonos, anticipos y reintegros del mes",
    },
    {
      label: "Garantías en custodia",
      value: fmtUsd(garantiasCustodia),
      icon: ShieldCheck,
      hint: "Depósitos reembolsables recibidos",
    },
    {
      label: "Facturado (Bs)",
      value: fmtBs(facturadoBs),
      icon: Landmark,
      hint: defaultRate ? `Tasa BCV: ${fmtNum(defaultRate)} Bs/USD` : "Sin tasa BCV",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagos y cobranza</h1>
          <p className="text-sm text-muted-foreground">
            Cuentas por cobrar, pagos registrados y facturación fiscal en bolívares.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceDialog
            targets={targets}
            defaultRate={defaultRate}
            trigger={
              <Button variant="outline">
                <FilePlus2 className="size-3.5" />
                Registrar factura
              </Button>
            }
          />
          <PaymentDialog
            targets={targets}
            defaultRate={defaultRate}
            parallelRate={parallelRate}
            bankAccounts={bankAccounts}
            trigger={
              <Button className="bg-sky-950 text-white hover:bg-sky-900">
                <Banknote className="size-3.5" />
                Registrar pago
              </Button>
            }
          />
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="py-4">
            <CardContent className="flex items-center gap-3 px-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-950/5 text-sky-950">
                <k.icon className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">{k.label}</p>
                <p className="truncate text-lg font-bold tabular-nums">{k.value}</p>
                <p className="truncate text-[11px] text-muted-foreground">{k.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <PagosTabs
        initialTab={tab}
        cxcRows={cxcRows}
        paymentRows={paymentRows}
        invoiceRows={invoiceRows}
        targets={targets}
        defaultRate={defaultRate}
        parallelRate={parallelRate}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}
