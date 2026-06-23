import Link from "next/link";
import { Building2, CalendarDays, Users, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtUsd } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpaceDialog } from "./space-dialog";
import type { SpaceDTO } from "./types";

export const metadata = { title: "Salones — Hotel Humboldt" };
export const dynamic = "force-dynamic";

export default async function SalonesPage() {
  const spaces = await prisma.space.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { reservations: true } } },
  });

  const dtos: (SpaceDTO & { reservationsCount: number })[] = spaces.map((s) => ({
    id: s.id,
    name: s.name,
    dailyRate: s.dailyRate,
    halfDayRate: s.halfDayRate,
    capacity: s.capacity,
    capacityNotes: s.capacityNotes,
    description: s.description,
    color: s.color,
    active: s.active,
    sortOrder: s.sortOrder,
    reservationsCount: s._count.reservations,
  }));

  const activeCount = dtos.filter((s) => s.active).length;

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salones</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} salón{activeCount === 1 ? "" : "es"} activo{activeCount === 1 ? "" : "s"} de{" "}
            {dtos.length} registrado{dtos.length === 1 ? "" : "s"} · Espacios para eventos del hotel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/calendario">
              <CalendarDays data-icon="inline-start" />
              Ver calendario
            </Link>
          </Button>
          <SpaceDialog nextSortOrder={dtos.length} />
        </div>
      </div>

      {/* Estado vacío */}
      {dtos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-sky-50 text-sky-950">
              <Building2 className="size-7" />
            </div>
            <div>
              <p className="font-semibold">Aún no hay salones registrados</p>
              <p className="text-sm text-muted-foreground">
                Cree el primer espacio del hotel para empezar a reservar eventos.
              </p>
            </div>
            <SpaceDialog nextSortOrder={0} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dtos.map((space) => (
            <Card
              key={space.id}
              className={`overflow-hidden p-0 gap-0 ${space.active ? "" : "opacity-60"}`}
            >
              {/* Barra de color del salón */}
              <div className="h-1.5 w-full" style={{ backgroundColor: space.color }} />
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: space.color }}
                    />
                    <h2 className="truncate text-sm font-semibold" title={space.name}>
                      {space.name}
                    </h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!space.active && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                    <SpaceDialog space={space} />
                  </div>
                </div>

                {/* Tarifas */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Tarifa por día
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {space.dailyRate != null ? (
                        fmtUsd(space.dailyRate)
                      ) : (
                        <span className="font-medium text-muted-foreground">Sin tarifa</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Media jornada
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {space.halfDayRate != null ? (
                        fmtUsd(space.halfDayRate)
                      ) : (
                        <span className="font-medium text-muted-foreground">Sin tarifa</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Capacidad */}
                {space.capacity != null ? (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="size-3.5" />
                    <span>
                      Capacidad: <span className="font-medium text-foreground">{space.capacity} pax</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 border border-amber-200">
                    <TriangleAlert className="size-3.5 shrink-0" />
                    Capacidad por definir con el hotel
                  </div>
                )}

                {(space.description || space.capacityNotes) && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {space.description && <p>{space.description}</p>}
                    {space.capacityNotes && <p className="italic">{space.capacityNotes}</p>}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t pt-2.5 text-[11px] text-muted-foreground">
                  <span>
                    {space.reservationsCount === 0
                      ? "Sin reservas"
                      : `${space.reservationsCount} reserva${space.reservationsCount === 1 ? "" : "s"} registrada${space.reservationsCount === 1 ? "" : "s"}`}
                  </span>
                  <span>Orden: {space.sortOrder}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
