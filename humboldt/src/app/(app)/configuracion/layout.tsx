import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { auth } from "@/lib/auth";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // El menú lateral de Configuración lo provee el sidebar principal (AppSidebar),
  // que se reemplaza por las secciones de Configuración mientras estás acá.
  // Las páginas de ajustes (parámetros, hotel, tasa, usuarios, tipos/canales) se
  // protegen individualmente por rol.

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-sky-950 text-white">
          <Settings className="size-4.5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground">
            Ajustes del sistema, catálogo de productos y salones.
          </p>
        </div>
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
