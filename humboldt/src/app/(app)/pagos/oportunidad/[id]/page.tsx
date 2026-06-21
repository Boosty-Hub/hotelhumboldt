// Estado de cuenta por oportunidad — resumen de cobranza, garantía,
// facturación, retenciones y diferencial cambiario informativo.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  FilePlus2,
  Info,
  Landmark,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentRate } from "@/lib/bcv";
import { fmtUsd, fmtBs, fmtNum, round2, bsToUsd } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  STAGE_COLORS,
  STAGE_LABELS,
  type PaymentMethod,
  type PaymentType,
  type Stage,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getTargetOptions, isGarantiaMovement, sumGarantiaCustodia, sumPagado } from "../../data";
import {
  GARANTIA_APLICACION_MARKER,
  GARANTIA_DEVOLUCION_MARKER,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
} from "../../types";
import { PaymentDialog } from "../../_components/payment-dialog";
import { InvoiceDialog } from "../../_components/invoice-dialog";
import { GarantiaActions } from "../../_components/garantia-actions";

export const metadata = { title: "Estado de cuenta" };

export default async function EstadoCuentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [opp, rateInfo, targets, bankAccounts] = await Promise.all([
    prisma.opportunity.findUnique({
      where: { id },
      include: {
        client: true,
        owner: true,
        quotes: { orderBy: { createdAt: "desc" } },
        payments: { include: { quote: true, installment: true }, orderBy: { date: "desc" } },
        invoices: { include: { retentions: true }, orderBy: { date: "desc" } },
      },
    }),
    getCurrentRate(),
    getTargetOptions(id),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currency: true, type: true },
    }),
  ]);

  if (!opp) notFound();

  const defaultRate = rateInfo?.rate ?? null;

  // ── Cálculos ────────────────────────────────────────────────────────
  const activeQuotes = opp.quotes.filter((q) =>
    ["APROBADA", "CONTRATADA"].includes(q.status)
  );
  const cotizado = round2(activeQuotes.reduce((s, q) => s + q.totalUsd, 0));
  const garantiaPactada = round2(activeQuotes.reduce((s, q) => s + q.depositAmount, 0));

  // Desglose por sección de las cotizaciones activas — referencia para abonos
  // parciales (los clientes abonan por AyB, espacios, misceláneos, etc.).
  const desglose = [
    { label: "Misceláneos", value: round2(activeQuotes.reduce((s, q) => s + q.subtotalMisc, 0)) },
    { label: "Alimentos y Bebidas", value: round2(activeQuotes.reduce((s, q) => s + q.subtotalFood, 0)) },
    { label: "Espacios", value: round2(activeQuotes.reduce((s, q) => s + q.subtotalSpaces, 0)) },
    { label: "Traslados (exento IVA)", value: round2(activeQuotes.reduce((s, q) => s + q.subtotalTransfers, 0)) },
    { label: "Servicio (sobre AyB)", value: round2(activeQuotes.reduce((s, q) => s + q.serviceAmount, 0)) },
    { label: "IVA", value: round2(activeQuotes.reduce((s, q) => s + q.taxAmount, 0)) },
  ].filter((d) => d.value > 0);

  const pagado = sumPagado(opp.payments);
  const garantiaCustodia = sumGarantiaCustodia(opp.payments);

  const garantiaRecibida = round2(
    opp.payments.filter((p) => p.type === "GARANTIA").reduce((s, p) => s + p.amountUsd, 0)
  );
  const garantiaDevuelta = round2(
    -opp.payments
      .filter(
        (p) => p.type === "REINTEGRO" && p.notes?.includes(GARANTIA_DEVOLUCION_MARKER)
      )
      .reduce((s, p) => s + p.amountUsd, 0)
  );
  const garantiaAplicada = round2(
    -opp.payments
      .filter(
        (p) => p.type === "REINTEGRO" && p.notes?.includes(GARANTIA_APLICACION_MARKER)
      )
      .reduce((s, p) => s + p.amountUsd, 0)
  );

  // Desglose por método (solo pagos contra el precio)
  const porMetodo = new Map<string, number>();
  for (const p of opp.payments) {
    if (isGarantiaMovement(p)) continue;
    porMetodo.set(p.method, round2((porMetodo.get(p.method) ?? 0) + p.amountUsd));
  }

  // Retenciones que cuentan como pago
  const validInvoices = opp.invoices.filter((i) => i.status !== "ANULADA");
  const retencionRows = validInvoices.flatMap((inv) =>
    inv.retentions
      .filter((r) => r.countsAsPayment)
      .map((r) => ({
        id: r.id,
        invoiceNumber: inv.number,
        type: r.type,
        amountBs: r.amountBs,
        usd: inv.rateUsed ? bsToUsd(r.amountBs, inv.rateUsed) : null,
      }))
  );
  const retencionesUsd = round2(retencionRows.reduce((s, r) => s + (r.usd ?? 0), 0));
  const retencionesBs = round2(retencionRows.reduce((s, r) => s + r.amountBs, 0));

  const pagadoEfectivo = round2(pagado + retencionesUsd);
  const saldo = round2(cotizado - pagadoEfectivo);

  const facturadoBs = round2(validInvoices.reduce((s, i) => s + (i.amountBs ?? 0), 0));
  const facturadoUsdRef = round2(validInvoices.reduce((s, i) => s + i.amountUsdRef, 0));

  // Diferencial cambiario informativo (pagos en Bs vs facturas)
  const bsPayments = opp.payments.filter(
    (p) => p.currency === "BS" && p.rateUsed && p.amountUsd > 0
  );
  const bsPagadoTotal = round2(bsPayments.reduce((s, p) => s + p.amountOriginal, 0));
  const usdPorPagosBs = round2(bsPayments.reduce((s, p) => s + p.amountUsd, 0));
  const avgPayRate = usdPorPagosBs > 0 ? round2(bsPagadoTotal / usdPorPagosBs) : null;
  const avgInvRate = facturadoUsdRef > 0 && facturadoBs > 0 ? round2(facturadoBs / facturadoUsdRef) : null;
  const showDiferencial =
    avgPayRate != null && avgInvRate != null && Math.abs(avgPayRate - avgInvRate) > 0.01;
  const diferencialUsd = showDiferencial
    ? round2(usdPorPagosBs - bsPagadoTotal / (avgInvRate as number))
    : 0;

  const presetTarget =
    targets.find((t) => t.kind === "QUOTE")?.value ?? targets[0]?.value ?? null;

  const kpis = [
    { label: "Cotizado", value: fmtUsd(cotizado), icon: Receipt, accent: "" },
    {
      label: "Pagado efectivo",
      value: fmtUsd(pagadoEfectivo),
      icon: Wallet,
      accent: "",
      hint: retencionesUsd > 0 ? `Incluye ${fmtUsd(retencionesUsd)} en retenciones` : undefined,
    },
    {
      label: "Saldo pendiente",
      value: fmtUsd(Math.max(saldo, 0)),
      icon: Banknote,
      accent:
        saldo <= 0.01 ? "text-emerald-700" : pagadoEfectivo > 0 ? "text-amber-700" : "",
      hint: saldo < -0.01 ? `Pagado en exceso: ${fmtUsd(-saldo)}` : undefined,
    },
    {
      label: "Garantía en custodia",
      value: fmtUsd(garantiaCustodia),
      icon: ShieldCheck,
      accent: "",
      hint: garantiaPactada > 0 ? `Pactada: ${fmtUsd(garantiaPactada)}` : undefined,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <Link
            href="/pagos"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Volver a Pagos
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {opp.client.brandName || opp.client.legalName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{opp.title}</span>
            <Badge variant="outline">{opp.code}</Badge>
            <Badge variant="outline" className={STAGE_COLORS[opp.stage as Stage]}>
              {STAGE_LABELS[opp.stage as Stage] ?? opp.stage}
            </Badge>
            <span className="text-xs">Ejecutivo: {opp.owner.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceDialog
            targets={targets}
            defaultRate={defaultRate}
            presetTargetValue={presetTarget}
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
            presetTargetValue={presetTarget}
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

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="py-4">
            <CardContent className="flex items-center gap-3 px-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-950/5 text-sky-950">
                <k.icon className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">{k.label}</p>
                <p className={cn("truncate text-lg font-bold tabular-nums", k.accent)}>
                  {k.value}
                </p>
                {k.hint && (
                  <p className="truncate text-[11px] text-muted-foreground">{k.hint}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desglose de la cotización por sección */}
      {desglose.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Desglose de la cotización</CardTitle>
            <CardDescription>
              Montos por sección — referencia para abonos parciales del cliente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
              {desglose.map((d) => (
                <div key={d.label} className="flex items-baseline justify-between border-b border-dashed border-zinc-100 pb-1">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium tabular-nums">{fmtUsd(d.value)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex items-baseline justify-between text-sm font-semibold text-sky-950">
              <span>Total cotizado</span>
              <span className="tabular-nums">{fmtUsd(cotizado)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diferencial cambiario */}
      {showDiferencial && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Diferencial cambiario informativo</AlertTitle>
          <AlertDescription>
            Los pagos en bolívares se registraron a una tasa promedio de{" "}
            <strong>{fmtNum(avgPayRate)}</strong> Bs/USD, mientras que la facturación usa
            una tasa promedio de <strong>{fmtNum(avgInvRate)}</strong> Bs/USD. Diferencia
            estimada sobre lo pagado en Bs:{" "}
            <strong className={diferencialUsd >= 0 ? "text-emerald-700" : "text-rose-600"}>
              {fmtUsd(diferencialUsd)}
            </strong>
            .
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Pagos */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="size-4 text-sky-900" />
              Pagos registrados
            </CardTitle>
            <CardDescription>
              {opp.payments.length === 0
                ? "Sin pagos para esta oportunidad."
                : `Pagado contra el precio: ${fmtUsd(pagado)} · Detalle por método abajo.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {opp.payments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                <Banknote className="size-7 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">
                  Registra el primer pago con el botón «Registrar pago».
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 px-6 pb-3">
                  {[...porMetodo.entries()].map(([m, v]) => (
                    <Badge key={m} variant="outline" className="tabular-nums">
                      {PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? m}: {fmtUsd(v)}
                    </Badge>
                  ))}
                  {retencionesUsd > 0 && (
                    <Badge variant="outline" className="tabular-nums">
                      Retenciones: {fmtUsd(retencionesUsd)}
                    </Badge>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-right">Tasa</TableHead>
                      <TableHead className="text-right">USD</TableHead>
                      <TableHead className="pr-6">Referencia / notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opp.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="pl-6 whitespace-nowrap">
                          {format(p.date, "dd/MM/yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>
                          {PAYMENT_TYPE_LABELS[p.type as PaymentType] ?? p.type}
                          {p.installment && (
                            <p className="text-[11px] text-muted-foreground">
                              {p.installment.label}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="max-w-32 truncate">
                          {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.currency === "BS"
                            ? fmtBs(p.amountOriginal)
                            : fmtUsd(p.amountOriginal)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {p.rateUsed ? fmtNum(p.rateUsed) : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium tabular-nums",
                            p.amountUsd < 0 && "text-rose-600"
                          )}
                        >
                          {fmtUsd(p.amountUsd)}
                        </TableCell>
                        <TableCell className="pr-6 max-w-44 truncate text-muted-foreground">
                          {[p.reference, p.notes].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        {/* Garantía */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-sky-900" />
              Garantía (depósito reembolsable)
            </CardTitle>
            <CardDescription>
              La garantía no forma parte del precio del evento — se devuelve o se aplica
              al saldo al cierre.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Pactada en cotización</dt>
                <dd className="font-medium tabular-nums">{fmtUsd(garantiaPactada)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Recibida</dt>
                <dd className="font-medium tabular-nums text-emerald-700">
                  {fmtUsd(garantiaRecibida)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Devuelta al cliente</dt>
                <dd className="font-medium tabular-nums">{fmtUsd(garantiaDevuelta)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Aplicada al saldo</dt>
                <dd className="font-medium tabular-nums">{fmtUsd(garantiaAplicada)}</dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="font-medium">En custodia (por devolver)</dt>
                <dd className="text-sm font-bold tabular-nums">{fmtUsd(garantiaCustodia)}</dd>
              </div>
            </dl>
            <GarantiaActions
              opportunityId={opp.id}
              quoteId={activeQuotes[0]?.id ?? null}
              disponible={garantiaCustodia}
              saldo={saldo}
            />
          </CardContent>
        </Card>

        {/* Facturación */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Landmark className="size-4 text-sky-900" />
              Facturación
            </CardTitle>
            <CardDescription>
              Facturado: <span className="font-medium">{fmtBs(facturadoBs)}</span> ·{" "}
              referencia <span className="font-medium">{fmtUsd(facturadoUsdRef)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {opp.invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                <Landmark className="size-7 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">
                  Aún no hay facturas para esta oportunidad.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Nº</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Bs</TableHead>
                    <TableHead className="text-right">Ref. USD</TableHead>
                    <TableHead className="text-right">Tasa</TableHead>
                    <TableHead className="pr-6">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opp.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="pl-6 font-medium">{inv.number}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(inv.date, "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>{INVOICE_TYPE_LABELS[inv.type] ?? inv.type}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtBs(inv.amountBs)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmtUsd(inv.amountUsdRef)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {inv.rateUsed ? fmtNum(inv.rateUsed) : "—"}
                      </TableCell>
                      <TableCell className="pr-6">
                        <Badge variant="outline" className={INVOICE_STATUS_COLORS[inv.status]}>
                          {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Retenciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="size-4 text-sky-900" />
              Retenciones (cuentan como pago)
            </CardTitle>
            <CardDescription>
              Total: <span className="font-medium">{fmtBs(retencionesBs)}</span>
              {retencionesUsd > 0 && (
                <>
                  {" "}
                  · ref <span className="font-medium">{fmtUsd(retencionesUsd)}</span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {retencionRows.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Sin retenciones registradas.
              </p>
            ) : (
              <ul className="space-y-2">
                {retencionRows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium">Retención {r.type}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Factura {r.invoiceNumber}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-medium">{fmtBs(r.amountBs)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.usd != null ? fmtUsd(r.usd) : "sin tasa"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
