"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  KanbanSquare,
  FileText,
  CalendarDays,
  Users,
  Contact,
  ClipboardList,
  Truck,
  Wallet,
  BarChart3,
  Settings,
  FileSignature,
  Landmark,
  ArrowLeft,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ConfigSidebar } from "@/app/(app)/configuracion/config-sidebar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Comercial",
    items: [
      { href: "/", label: "Panel general", icon: LayoutDashboard },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/cotizaciones", label: "Cotizaciones", icon: FileText },
      { href: "/beo", label: "BEO", icon: ClipboardList },
      { href: "/calendario", label: "Calendario", icon: CalendarDays },
    ],
  },
  {
    title: "Gestión",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/contactos", label: "Contactos", icon: Contact },
      { href: "/proveedores", label: "Proveedores", icon: Truck },
      { href: "/documentos", label: "Documentos", icon: FileSignature },
      { href: "/pagos", label: "Pagos", icon: Wallet },
      { href: "/bancos", label: "Bancos", icon: Landmark },
    ],
  },
  {
    title: "Análisis",
    items: [
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

export function AppSidebar({
  role,
  isAdmin,
  isManager,
}: {
  role: string;
  isAdmin: boolean;
  isManager: boolean;
}) {
  const pathname = usePathname();
  // En Configuración el menú lateral SE REEMPLAZA por el de configuración
  // (no se muestran dos sidebars). El usuario vuelve con "Volver al sistema".
  const inConfig = pathname.startsWith("/configuracion");

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground print:hidden">
      {/* Marca */}
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <Logo className="h-10 w-auto" priority />
        <span className="text-[11px] leading-tight text-muted-foreground">
          Sistema
          <br />
          Comercial
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {inConfig ? (
          <>
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              Volver al sistema
            </Link>
            <ConfigSidebar isAdmin={isAdmin} isManager={isManager} />
          </>
        ) : (
          NAV_GROUPS.map((group) => {
          const items = group.items.filter(
            (i) => !i.adminOnly || role === "ADMIN" || role === "GERENTE"
          );
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-sky-950 text-white shadow-sm"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
        )}
      </nav>
    </aside>
  );
}
