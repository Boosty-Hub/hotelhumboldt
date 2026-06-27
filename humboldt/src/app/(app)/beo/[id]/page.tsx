import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BeoEditor, type BeoData } from "./beo-editor";
import type { BeoDepartmentReq, BeoMenuSection, BeoScheduleItem } from "../constants";

export const metadata = { title: "BEO" };
export const dynamic = "force-dynamic";

export default async function BeoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [beo, editedCount] = await Promise.all([
    prisma.beo.findUnique({ where: { id } }),
    // ¿El BEO ya fue guardado/emitido alguna vez? (más allá del CREADO automático
    // de la generación). Persistente: al reabrir un BEO ya trabajado, los botones
    // de compartir/emitir vuelven a aparecer sin necesidad de re-guardar.
    prisma.beoLog.count({ where: { beoId: id, action: { not: "CREADO" } } }),
  ]);
  if (!beo) notFound();
  const savedBefore = editedCount > 0 || beo.status === "EMITIDO";

  const data: BeoData = {
    id: beo.id,
    number: beo.number,
    status: beo.status,
    responsable: beo.responsable ?? "",
    eventName: beo.eventName ?? "",
    clientName: beo.clientName ?? "",
    spaceName: beo.spaceName ?? "",
    eventDate: beo.eventDate ? beo.eventDate.toISOString().slice(0, 10) : "",
    startTime: beo.startTime ?? "",
    pax: beo.pax,
    publicToken: beo.publicToken,
    schedule: (beo.schedule as BeoScheduleItem[] | null) ?? [],
    menu: (beo.menu as BeoMenuSection[] | null) ?? [],
    departments: (beo.departments as BeoDepartmentReq[] | null) ?? [],
    generalNotes: beo.generalNotes ?? "",
  };

  return <BeoEditor beo={data} savedBefore={savedBefore} />;
}
