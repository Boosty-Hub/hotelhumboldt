import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { History, Landmark, Percent } from "lucide-react";
import { auth, canManageSettings } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentRate } from "@/lib/bcv";
import { fmtBs } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParamRow } from "./components/param-row";
import { HotelForm } from "./components/hotel-form";
import { UsersTable } from "./components/users-table";
import { CatalogColumn } from "./components/catalog-column";
import { RatePanel } from "./components/rate-panel";

export const metadata = { title: "Configuración" };

// Notas explicativas bajo cada parámetro comercial
const PARAM_NOTES: Record<string, string> = {
  iva_pct:
    "El IVA se calcula sobre Misceláneos + AyB + Espacios; los traslados están exentos. Se factura en bolívares a tasa BCV.",
  service_pct:
    "El cargo de servicio aplica únicamente sobre Alimentos y Bebidas y no forma parte de la base imponible del IVA.",
  igtf_pct:
    "Informativo: aplica solo cuando el cliente paga en divisas. No se suma al total de la cotización.",
  deposit_pct:
    "Garantía reembolsable que se cobra como depósito separado para cubrir consumos adicionales o daños. No se suma al total del evento.",
  quote_validity_days:
    "Días continuos de vigencia de cada cotización desde su fecha de emisión.",
  default_markup_pct:
    "Markup sugerido sobre el costo del proveedor al fijar precios de venta. Información interna.",
  min_margin_pct:
    "Si está habilitado, el cotizador alertará cuando el margen de una línea quede por debajo de este valor. Información interna.",
};

// Orden de presentación dentro de cada grupo
const PARAM_ORDER = [
  "iva_pct",
  "service_pct",
  "igtf_pct",
  "deposit_pct",
  "quote_validity_days",
  "default_markup_pct",
  "min_margin_pct",
];

const RATE_SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  BCV: { label: "BCV", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  MANUAL: { label: "Manual", className: "bg-amber-100 text-amber-800 border-amber-200" },
};

function suffixFor(key: string): string {
  if (key.endsWith("_pct")) return "%";
  if (key.endsWith("_days")) return "días";
  return "";
}

export default async function ConfiguracionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!canManageSettings(role) && role !== "GERENTE") redirect("/");
  const isAdmin = canManageSettings(role);

  const [settings, eventTypes, channels, rate, rateHistory, users] = await Promise.all([
    prisma.setting.findMany(),
    prisma.eventTypeOption.findMany({ orderBy: { name: "asc" } }),
    prisma.channelOption.findMany({ orderBy: { name: "asc" } }),
    getCurrentRate(),
    prisma.exchangeRate.findMany({ orderBy: { date: "desc" }, take: 30 }),
    isAdmin
      ? prisma.user.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  // Parámetros numéricos agrupados por categoría
  const numericSettings = settings
    .filter((s) => s.type === "number" && (s.category === "impuestos" || s.category === "comercial"))
    .sort((a, b) => {
      const ia = PARAM_ORDER.indexOf(a.key);
      const ib = PARAM_ORDER.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  const taxSettings = numericSettings.filter((s) => s.category === "impuestos");
  const commercialSettings = numericSettings.filter((s) => s.category === "comercial");

  const hotelValues = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Parámetros comerciales, datos del hotel, usuarios, catálogos y tasa de cambio.
        </p>
      </div>

      <Tabs defaultValue="parametros">
        <TabsList className="h-9 w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="parametros" className="px-3">
            Parámetros comerciales
          </TabsTrigger>
          <TabsTrigger value="hotel" className="px-3">
            Hotel
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="usuarios" className="px-3">
              Usuarios
            </TabsTrigger>
          )}
          <TabsTrigger value="catalogos" className="px-3">
            Catálogos
          </TabsTrigger>
          <TabsTrigger value="tasa" className="px-3">
            Tasa de cambio
          </TabsTrigger>
        </TabsList>

        {/* ── Parámetros comerciales ── */}
        <TabsContent value="parametros" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Percent className="size-4 text-sky-950" />
                <CardTitle>Impuestos y cargos</CardTitle>
              </div>
              <CardDescription>
                Cada cargo puede habilitarse o deshabilitarse; los cambios aplican a las
                cotizaciones nuevas (las existentes conservan su configuración).
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {taxSettings.map((s) => (
                <ParamRow
                  key={s.key}
                  settingKey={s.key}
                  label={s.label ?? s.key}
                  value={s.value}
                  enabled={s.enabled}
                  note={PARAM_NOTES[s.key]}
                  suffix={suffixFor(s.key)}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-sky-950" />
                <CardTitle>Política comercial</CardTitle>
              </div>
              <CardDescription>
                Garantía, vigencia de cotizaciones y parámetros internos de precios.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {commercialSettings.map((s) => (
                <ParamRow
                  key={s.key}
                  settingKey={s.key}
                  label={s.label ?? s.key}
                  value={s.value}
                  enabled={s.enabled}
                  note={PARAM_NOTES[s.key]}
                  suffix={suffixFor(s.key)}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Hotel ── */}
        <TabsContent value="hotel" className="mt-4">
          <HotelForm values={hotelValues} />
        </TabsContent>

        {/* ── Usuarios (solo ADMIN) ── */}
        {isAdmin && (
          <TabsContent value="usuarios" className="mt-4">
            <UsersTable users={users} currentUserId={session.user.id} />
          </TabsContent>
        )}

        {/* ── Catálogos ── */}
        <TabsContent value="catalogos" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <CatalogColumn
              kind="eventType"
              title="Tipos de evento"
              description="Clasifican las oportunidades: bodas, convenciones, cócteles…"
              items={eventTypes}
            />
            <CatalogColumn
              kind="channel"
              title="Canales de ingreso"
              description="Cómo llegó el cliente: CRM, referido, casa matriz…"
              items={channels}
            />
          </div>
        </TabsContent>

        {/* ── Tasa de cambio ── */}
        <TabsContent value="tasa" className="mt-4 space-y-6">
          <RatePanel
            rate={rate ? { rate: rate.rate, date: rate.date, source: rate.source } : null}
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
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">
                            {format(r.date, "dd/MM/yyyy hh:mm a", { locale: es })}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
