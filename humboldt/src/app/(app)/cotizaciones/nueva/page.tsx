import { format } from "date-fns";
import { toDayKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  NewQuoteForm,
  type ClientOption,
  type OppOption,
} from "@/components/quote/new-quote-form";

export const metadata = { title: "Nueva cotización" };

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const preselected = typeof sp.oportunidad === "string" ? sp.oportunidad : null;
  const preselectedClient = typeof sp.cliente === "string" ? sp.cliente : null;

  const [opportunities, clients, spaces] = await Promise.all([
    prisma.opportunity.findMany({
      where: { stage: { not: "PERDIDO" } },
      include: { client: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { legalName: "asc" },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          select: { id: true, name: true, title: true },
        },
      },
    }),
    prisma.space.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const oppOptions: OppOption[] = opportunities.map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    clientName: o.client.brandName ?? o.client.legalName,
    expectedEventDate: o.expectedEventDate ? toDayKey(o.expectedEventDate) : null,
    pax: o.pax,
  }));

  const clientOptions: ClientOption[] = clients.map((c) => ({
    id: c.id,
    legalName: c.legalName,
    brandName: c.brandName,
    contacts: c.contacts.map((ct) => ({ id: ct.id, name: ct.name, title: ct.title })),
  }));

  return (
    <NewQuoteForm
      opportunities={oppOptions}
      clients={clientOptions}
      spaces={spaces}
      preselectedOpportunityId={preselected}
      preselectedClientId={preselectedClient}
    />
  );
}
