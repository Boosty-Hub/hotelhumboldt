import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { History } from "lucide-react";
import { auth, canManageSettings } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentRate, getParallelRate } from "@/lib/bcv";
import { fmtBs } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RatePanel } from "../components/rate-panel";
import { ParallelRatePanel } from "../components/parallel-rate-panel";
import { RATE_SOURCE_BADGES } from "../config-meta";

export const metadata = { title: "Tasa de cambio" };

const KIND_BADGES: Record<string, { label: string; className: string }> = {
  OFICIAL: { label: "Oficial (BCV)", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PARALELA: { label: "Paralela", className: "bg-violet-50 text-violet-700 border-violet-200" },
};

export default async function TasaPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (!canManageSettings(role) && role !== "GERENTE") redirect("/configuracion/catalogo");

  const [rate, parallel, rateHistory] = await Promise.all([
    getCurrentRate(),
    getParallelRate(),
    prisma.exchangeRate.findMany({ orderBy: { date: "desc" }, take: 30 }),
  ]);

  return (
    <div className="space-y-6">
      <RatePanel
        rate={rate ? { rate: rate.rate, date: rate.date, source: rate.source } : null}
      />

      <ParallelRatePanel
        rate={parallel ? { rate: parallel.rate, date: parallel.date, source: parallel.source } : null}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="size-4 text-sky-950" />
            <CardTitle>Historial de tasas</CardTitle>
          </div>
          <CardDescription>Últimos {rateHistory.length} registros.</CardDescription>
        </CardHeader>
        <CardContent>
          {rateHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <History className="size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">Sin registros de tasa</p>
              <p className="text-xs text-muted-foreground">
                Actualiza desde el BCV o registra una tasa manual.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Mercado</TableHead>
                  <TableHead className="text-right">Tasa (Bs/USD)</TableHead>
                  <TableHead className="text-right">Fuente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateHistory.map((r) => {
                  const badge = RATE_SOURCE_BADGES[r.source] ?? {
                    label: r.source,
                    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
                  };
                  const kindBadge = KIND_BADGES[r.kind] ?? {
                    label: r.kind,
                    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
                  };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {format(r.date, "dd/MM/yyyy hh:mm a", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={kindBadge.className}>
                          {kindBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {fmtBs(r.rate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
