import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BeoEditor, type BeoData } from "./beo-editor";
import type { BeoDepartmentReq, BeoMenuSection, BeoScheduleItem } from "../constants";

export const metadata = { title: "BEO" };
export const dynamic = "force-dynamic";

export default async function BeoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const beo = await prisma.beo.findUnique({ where: { id } });
  if (!beo) notFound();

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

  return <BeoEditor beo={data} />;
}
