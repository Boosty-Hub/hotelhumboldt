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

  const [opportunities, clients] = await Promise.all([
    prisma.opportunity.findMany({
      where: { stage: { not: "PERDIDO" } },
      include: { client: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { legalName: "asc" },
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
  }));

  return (
    <NewQuoteForm
      opportunities={oppOptions}
      clients={clientOptions}
      preselectedOpportunityId={preselected}
    />
  );
}
