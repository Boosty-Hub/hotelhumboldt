import { toDayKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  NewQuoteForm,
  type ClientOption,
  type ContactPickOption,
  type OppOption,
} from "@/components/quote/new-quote-form";

export const metadata = { title: "Nueva cotización" };

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const preselectedOpp = typeof sp.oportunidad === "string" ? sp.oportunidad : null;
  const preselectedContact = typeof sp.contacto === "string" ? sp.contacto : null;
  const preselectedClient = typeof sp.cliente === "string" ? sp.cliente : null;

  const [opportunities, clients, contacts, spaces, eventTypes, channels] = await Promise.all([
    prisma.opportunity.findMany({
      where: { stage: { not: "PERDIDO" } },
      include: { client: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { legalName: "asc" },
      select: { id: true, legalName: true, brandName: true },
    }),
    // Todos los contactos con sus empresas (M-N): un contacto puede tener 0, 1 o
    // varias. Alimentan el diálogo de crear oportunidad.
    prisma.contact.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        title: true,
        clientLinks: {
          select: { client: { select: { id: true, legalName: true, brandName: true } } },
        },
      },
    }),
    prisma.space.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.eventTypeOption.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.channelOption.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const oppOptions: OppOption[] = opportunities.map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    clientName: o.client?.brandName ?? o.client?.legalName ?? "Sin empresa",
    expectedEventDate: o.expectedEventDate ? toDayKey(o.expectedEventDate) : null,
    pax: o.pax,
  }));

  const clientOptions: ClientOption[] = clients.map((c) => ({
    id: c.id,
    legalName: c.legalName,
    brandName: c.brandName,
  }));

  // Cada contacto con la lista de empresas a las que pertenece (puede ser vacía).
  const contactOptions: ContactPickOption[] = contacts.map((ct) => ({
    id: ct.id,
    name: ct.name,
    title: ct.title,
    clients: ct.clientLinks.map((l) => ({
      id: l.client.id,
      name: l.client.brandName ?? l.client.legalName,
    })),
  }));

  // Deep link: ?contacto=<id> directo, o ?cliente=<id> → un contacto de ese cliente.
  // Si viene, se abre el diálogo de "crear oportunidad" con ese contacto preseleccionado.
  const preselectedContactId =
    preselectedContact ??
    (preselectedClient
      ? contactOptions.find((ct) => ct.clients.some((c) => c.id === preselectedClient))?.id ?? null
      : null);

  return (
    <NewQuoteForm
      opportunities={oppOptions}
      contacts={contactOptions}
      clients={clientOptions}
      spaces={spaces}
      eventTypes={eventTypes.map((t) => t.name)}
      channels={channels.map((c) => c.name)}
      preselectedOpportunityId={preselectedOpp}
      preselectedContactId={preselectedContactId}
    />
  );
}
