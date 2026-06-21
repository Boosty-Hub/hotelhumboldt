import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const now = new Date();
  const fechaContratoLarga = `los ${format(now, "d", { locale: es })} días del mes de ${format(
    now,
    "MMMM 'de' yyyy",
    { locale: es }
  )}`;

  return <ContratoGenerator clients={clients} fechaContratoLarga={fechaContratoLarga} />;
}
