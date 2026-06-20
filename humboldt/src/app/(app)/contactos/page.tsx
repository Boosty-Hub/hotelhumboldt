import { prisma } from "@/lib/prisma";
import { ContactsView } from "./components/contacts-view";

export const metadata = { title: "Contactos" };

export default async function ContactosPage() {
  const [contacts, clients] = await Promise.all([
    prisma.contact.findMany({
      include: { client: { select: { id: true, legalName: true, brandName: true } } },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.client.findMany({
      where: { active: true },
      select: { id: true, legalName: true, brandName: true },
      orderBy: { legalName: "asc" },
    }),
  ]);

  const rows = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    phone: c.phone,
    email: c.email,
    isPrimary: c.isPrimary,
    clientId: c.clientId,
    clientName: c.client.brandName ?? c.client.legalName,
  }));

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.brandName ?? c.legalName,
  }));

  return <ContactsView contacts={rows} clients={clientOptions} />;
}
