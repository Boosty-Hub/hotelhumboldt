import { prisma } from "@/lib/prisma";
import { CatalogColumn } from "../components/catalog-column";

export const metadata = { title: "Catálogos" };

export default async function CatalogosPage() {
  const [eventTypes, channels] = await Promise.all([
    prisma.eventTypeOption.findMany({ orderBy: { name: "asc" } }),
    prisma.channelOption.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
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
  );
}
