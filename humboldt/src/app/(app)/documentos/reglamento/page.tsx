import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { ReglamentoGenerator } from "./reglamento-generator";

export const metadata = { title: "Reglamento de proveedores" };

export default async function ReglamentoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
  return <ReglamentoGenerator today={today} />;
}
