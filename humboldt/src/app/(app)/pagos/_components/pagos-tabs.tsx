"use client";

// Tabs del módulo Pagos — el tab activo se refleja en la URL (?tab=…)
// para permitir enlaces directos.

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { CxcRow, InvoiceRow, PaymentRow, TargetOption } from "../types";
import { CxcTable } from "./cxc-table";
import { PaymentsTable } from "./payments-table";
import { InvoicesTable } from "./invoices-table";
import type { BankAccountOption } from "./payment-dialog";

export function PagosTabs({
  initialTab,
  cxcRows,
  paymentRows,
  invoiceRows,
  targets,
  defaultRate,
  bankAccounts,
}: {
  initialTab: string;
  cxcRows: CxcRow[];
  paymentRows: PaymentRow[];
  invoiceRows: InvoiceRow[];
  targets: TargetOption[];
  defaultRate: number | null;
  bankAccounts: BankAccountOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const valid = ["cxc", "pagos", "facturas"];
  const tab = valid.includes(initialTab) ? initialTab : "cxc";

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="cxc" className="gap-1.5 px-3">
          Cuentas por cobrar
          <Badge variant="secondary" className="h-4 px-1.5">
            {cxcRows.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="pagos" className="gap-1.5 px-3">
          Pagos registrados
          <Badge variant="secondary" className="h-4 px-1.5">
            {paymentRows.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="facturas" className="gap-1.5 px-3">
          Facturas
          <Badge variant="secondary" className="h-4 px-1.5">
            {invoiceRows.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cxc" className="mt-3">
        <CxcTable
          rows={cxcRows}
          targets={targets}
          defaultRate={defaultRate}
          bankAccounts={bankAccounts}
        />
      </TabsContent>
      <TabsContent value="pagos" className="mt-3">
        <PaymentsTable rows={paymentRows} />
      </TabsContent>
      <TabsContent value="facturas" className="mt-3">
        <InvoicesTable rows={invoiceRows} />
      </TabsContent>
    </Tabs>
  );
}
