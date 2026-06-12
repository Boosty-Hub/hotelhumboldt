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
  // Solo Admin y Gerente acceden a Configuración
  if (!canManageSettings(role) && role !== "GERENTE") redirect("/");
  const isAdmin = canManageSettings(role);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-sky-950 text-white">
          <Settings className="size-4.5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground">
            Parámetros comerciales, datos del hotel, usuarios, catálogos y tasa de cambio.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar de configuración */}
        <aside className="lg:w-64 lg:shrink-0">
          <ConfigSidebar isAdmin={isAdmin} />
        </aside>

        {/* Contenido del módulo activo */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
