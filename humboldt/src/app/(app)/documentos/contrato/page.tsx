import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDayEs } from "@/lib/dates";
import { quoteBaseNumber } from "@/components/quote/quote-utils";
import { ContratoGenerator } from "./contrato-generator";

export const metadata = { title: "Contrato de evento" };

export default async function ContratoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const clients = await prisma.client.findMany({
    where: { active: true },
    orderBy: { legalName: "asc" },
    select: {
      id: true,
      legalName: true,
      brandName: true,
      rif: true,
      address: true,
      contacts: {
        select: { id: true, name: true, title: true },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      },
    },
  });

  // Cotizaciones ganadas/aprobadas: el contrato se ata a una de ellas.
  const wonQuotes = await prisma.quote.findMany({
    where: { status: { in: ["APROBADA", "CONTRATADA"] } },
    orderBy: [{ issueDate: "desc" }],
    take: 100,
    include: {
      opportunity: {
        include: {
          client: {
            include: { contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 1 } },
          },
          contact: true,
        },
      },
      event: true,
    },
  });

  const quotes = wonQuotes.map((q) => {
    const c = q.opportunity.client;
    const ct = q.opportunity.contact ?? c.contacts[0] ?? null;
    const ev = q.event;
    const numero = `${quoteBaseNumber(q.number)}${q.version > 1 ? ` v${q.version}` : ""}`;
    return {
      id: q.id,
      numero,
      label: `${numero} · ${c.brandName ?? c.legalName}${ev?.name ? ` · ${ev.name}` : ""}`,
      cliente: c.brandName ?? c.legalName,
      rif: c.rif ?? "",
      direccion: c.address ?? "",
      representante: ct?.name ?? "",
      contacto: ct?.name ?? "",
      fechaEvento: ev?.startDate ? formatDayEs(ev.startDate, "d 'de' MMMM 'de' yyyy") : "",
      horario: ev?.startTime ? `${ev.startTime}${ev.endTime ? ` A ${ev.endTime}` : ""}` : "",
    };
  });

  const now = new Date();
  const fechaContratoLarga = `los ${format(now, "d", { locale: es })} días del mes de ${format(
    now,
    "MMMM 'de' yyyy",
    { locale: es }
  )}`;

  return (
    <ContratoGenerator
      clients={clients}
      quotes={quotes}
      fechaContratoLarga={fechaContratoLarga}
    />
  );
}
