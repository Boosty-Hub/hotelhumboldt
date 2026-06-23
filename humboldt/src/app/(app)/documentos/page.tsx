import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSignature, ScrollText, ChevronRight } from "lucide-react";

export const metadata = { title: "Documentos" };

const DOCS = [
  {
    href: "/documentos/contrato",
    title: "Contrato de evento",
    description:
      "Contrato para la celebración de eventos. Se auto-rellena con los datos del cliente y la fecha; el contenido legal no cambia.",
    icon: FileSignature,
  },
  {
    href: "/documentos/reglamento",
    title: "Reglamento de proveedores",
    description:
      "Reglamento y condiciones generales para empresas y proveedores. Texto fijo con la declaración final auto-rellenable.",
    icon: ScrollText,
  },
];

export default async function DocumentosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Plantillas oficiales auto-rellenables. El contenido es fijo; solo se completan los datos
          del cliente/proveedor y la fecha. Imprimís a PDF para firmar y entregar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DOCS.map((doc) => (
          <Link key={doc.href} href={doc.href} className="group">
            <Card className="h-full transition-colors hover:border-sky-300 hover:bg-accent/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-sky-950 text-white">
                    <doc.icon className="size-4.5" />
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <CardTitle className="mt-2 text-base">{doc.title}</CardTitle>
                <CardDescription>{doc.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
