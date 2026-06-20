"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  KanbanSquare,
  FileText,
  CalendarDays,
  Building2,
  Users,
  Contact,
  ClipboardList,
  Truck,
  UtensilsCrossed,
  Wallet,
  BarChart3,
  Settings,
  Mountain,
} from "lucide-react";

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
      { href: "/salones", label: "Salones", icon: Building2 },
      { href: "/catalogo", label: "Catálogo", icon: UtensilsCrossed },
      { href: "/proveedores", label: "Proveedores", icon: Truck },
      { href: "/pagos", label: "Pagos", icon: Wallet },
    ],
  },
  {
    title: "Análisis",
    items: [
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
      { href: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
    ],
  },
];

export function AppSidebar({ role }: { role: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-950 text-white">
          <Mountain className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">Hotel Humboldt</p>
          <p className="text-[11px] text-muted-foreground">Sistema Comercial</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => {
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
        })}
      </nav>
    </aside>
  );
}
