import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { parseDir } from "@/lib/list-query";
import { ContactsView } from "./components/contacts-view";

export const metadata = { title: "Contactos" };

/** Búsqueda insensible a acentos y mayúsculas. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const dir = parseDir(sp, "asc"); // alfabético A–Z por defecto
  const onlyPrimary = sp.principales === "1";

  // El switch "solo principales" y el orden van a la DB; la búsqueda de texto se
  // hace en memoria (insensible a acentos). Contact no tiene fecha, no hay rango.
  // "Principal" es por-empresa (ClientContact.isPrimary) → principal de alguna.
  const where: Prisma.ContactWhereInput = {};
  if (onlyPrimary) where.clientLinks = { some: { isPrimary: true } };

  const [contacts, total, clients] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        clientLinks: {
          include: { client: { select: { id: true, legalName: true, brandName: true } } },
        },
      },
      orderBy: { name: dir },
      take: 500,
    }),
    prisma.contact.count(),
    prisma.client.findMany({
      where: { active: true },
      select: { id: true, legalName: true, brandName: true },
      orderBy: { legalName: "asc" },
    }),
  ]);

  const nq = norm(q);
  const rows = contacts
    .map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      phone: c.phone,
      email: c.email,
      isPrimary: c.clientLinks.some((l) => l.isPrimary),
      clients: c.clientLinks.map((l) => ({
        id: l.client.id,
        name: l.client.brandName ?? l.client.legalName,
      })),
    }))
    .filter(
      (c) =>
        !nq ||
        norm(c.name).includes(nq) ||
        c.clients.some((cl) => norm(cl.name).includes(nq)) ||
        norm(c.title ?? "").includes(nq) ||
        norm(c.email ?? "").includes(nq) ||
        norm(c.phone ?? "").includes(nq)
    );

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.brandName ?? c.legalName,
  }));

  const hasFilters = Boolean(q || onlyPrimary);

  return (
    <ContactsView
      contacts={rows}
      clients={clientOptions}
      total={total}
      filtered={rows.length}
      onlyPrimary={onlyPrimary}
      hasFilters={hasFilters}
    />
  );
}
