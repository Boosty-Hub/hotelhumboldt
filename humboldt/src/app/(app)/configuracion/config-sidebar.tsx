"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Percent,
  Building2,
  Users,
  Tags,
  Coins,
  type LucideIcon,
} from "lucide-react";

interface ConfigNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const CONFIG_NAV: ConfigNavItem[] = [
  {
    href: "/configuracion/parametros",
    label: "Parámetros comerciales",
    description: "IVA, servicio, garantía, vigencia, márgenes",
    icon: Percent,
  },
  {
    href: "/configuracion/hotel",
    label: "Datos del hotel",
    description: "Nombre, RIF, contacto y plantilla de cotización",
    icon: Building2,
  },
  {
    href: "/configuracion/usuarios",
    label: "Usuarios",
    description: "Cuentas, roles y accesos",
    icon: Users,
    adminOnly: true,
  },
  {
    href: "/configuracion/catalogos",
    label: "Catálogos",
    description: "Tipos de evento y canales de ingreso",
    icon: Tags,
  },
  {
    href: "/configuracion/tasa",
    label: "Tasa de cambio",
    description: "Tasa BCV y registro manual",
    icon: Coins,
  },
];

export function ConfigSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = CONFIG_NAV.filter((i) => !i.adminOnly || isAdmin);

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex shrink-0 items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors lg:shrink",
              active
                ? "border-sky-200 bg-sky-50 text-sky-950"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                active ? "text-sky-700" : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <div className="min-w-0">
              <p className={cn("text-sm font-medium leading-tight", active && "text-sky-950")}>
                {item.label}
              </p>
              <p className="mt-0.5 hidden text-[11px] text-muted-foreground lg:block">
                {item.description}
              </p>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
