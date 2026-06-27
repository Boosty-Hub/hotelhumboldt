// Carga y arma las props del documento PDF del BEO, compartido por la ruta
// autenticada (/beo/[id]/pdf) y la pública (/orden/[token]/pdf). Así ambas
// generan EXACTAMENTE el mismo PDF.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDayEs } from "@/lib/dates";
import { SETTING_KEYS } from "@/lib/constants";
import type { BeoPdfProps } from "@/components/beo/beo-pdf-document";
import type {
  BeoDepartmentReq,
  BeoMenuSection,
  BeoScheduleItem,
} from "@/app/(app)/beo/constants";

export interface BeoPdfData {
  props: BeoPdfProps;
  fileName: string;
}

/** Carga el BEO (por id o publicToken) y arma las props del PDF. null si no existe. */
export async function loadBeoPdfData(
  where: Prisma.BeoWhereUniqueInput
): Promise<BeoPdfData | null> {
  const [beo, hotelSetting] = await Promise.all([
    prisma.beo.findUnique({ where }),
    prisma.setting.findFirst({ where: { key: SETTING_KEYS.HOTEL_NAME } }),
  ]);
  if (!beo) return null;

  const dateLabel = beo.eventDate
    ? formatDayEs(beo.eventDate, "EEEE d 'de' MMMM 'de' yyyy")
    : null;

  const props: BeoPdfProps = {
    hotelName: hotelSetting?.value ?? "Hotel Humboldt",
    number: beo.number,
    eventName: beo.eventName,
    clientName: beo.clientName,
    spaceName: beo.spaceName,
    eventDateLabel: dateLabel ? dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1) : null,
    startTime: beo.startTime,
    pax: beo.pax,
    responsable: beo.responsable,
    schedule: (beo.schedule as BeoScheduleItem[] | null) ?? [],
    menu: (beo.menu as BeoMenuSection[] | null) ?? [],
    departments: (beo.departments as BeoDepartmentReq[] | null) ?? [],
    generalNotes: beo.generalNotes,
  };

  return { props, fileName: `BEO ${beo.number}.pdf` };
}
