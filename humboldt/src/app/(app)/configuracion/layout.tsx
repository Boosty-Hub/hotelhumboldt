import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { auth, canManageSettings } from "@/lib/auth";
import { ConfigSidebar } from "./config-sidebar";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  // El módulo es accesible para todos los roles: Catálogo y Salones son operativos.
  // Las páginas de ajustes (parámetros, hotel, tasa, usuarios, tipos/canales) se
  // protegen individualmente y se ocultan del sidebar a quien no corresponda.
  const isAdmin = canManageSettings(role);
  const isManager = isAdmin || role === "GERENTE";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-sky-950 text-white">
          <Settings className="size-4.5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? "Parámetros comerciales, datos del hotel, usuarios, catálogo, salones y tasa de cambio."
              : "Catálogo de productos y salones del hotel."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar de configuración */}
        <aside className="lg:w-64 lg:shrink-0">
          <ConfigSidebar isAdmin={isAdmin} isManager={isManager} />
        </aside>

        {/* Contenido del módulo activo */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
