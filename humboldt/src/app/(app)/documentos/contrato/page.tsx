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

  const clientRows = await prisma.client.findMany({
    where: { active: true },
    orderBy: { legalName: "asc" },
    select: {
      id: true,
      legalName: true,
      brandName: true,
      rif: true,
      address: true,
      contactLinks: {
        orderBy: [{ isPrimary: "desc" }, { contact: { name: "asc" } }],
        select: { contact: { select: { id: true, name: true, title: true } } },
      },
    },
  });
  // Aplana los vínculos M-N a la forma { ...cliente, contacts } que espera el generador.
  const clients = clientRows.map(({ contactLinks, ...c }) => ({
    ...c,
    contacts: contactLinks.map((l) => l.contact),
  }));

  // Cotizaciones ganadas/aprobadas: el contrato se ata a una de ellas.
  const wonQuotes = await prisma.quote.findMany({
    where: { status: { in: ["APROBADA", "CONTRATADA"] } },
    orderBy: [{ issueDate: "desc" }],
    take: 100,
    include: {
      opportunity: {
        include: {
          client: {
            include: {
              contactLinks: {
                where: { isPrimary: true },
                take: 1,
                select: { contact: { select: { id: true, name: true, title: true } } },
              },
            },
          },
          contact: true,
        },
      },
      event: true,
    },
  });

  const quotes = wonQuotes.map((q) => {
    const c = q.opportunity.client;
    const ct = q.opportunity.contact ?? c?.contactLinks[0]?.contact ?? null;
    const ev = q.event;
    const numero = `${quoteBaseNumber(q.number)}${q.version > 1 ? ` v${q.version}` : ""}`;
    return {
      id: q.id,
      numero,
      label: `${numero} · ${c ? (c.brandName ?? c.legalName) : (ct?.name ?? "Sin empresa")}${ev?.name ? ` · ${ev.name}` : ""}`,
      cliente: c ? (c.brandName ?? c.legalName) : (ct?.name ?? "Sin empresa"),
      rif: c?.rif ?? "",
      direccion: c?.address ?? "",
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
