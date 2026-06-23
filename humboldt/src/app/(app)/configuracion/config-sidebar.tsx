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
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

type Access = "all" | "manager" | "admin";

interface ConfigNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  access: Access;
}

interface ConfigGroup {
  title: string;
  items: ConfigNavItem[];
}

const CONFIG_GROUPS: ConfigGroup[] = [
  {
    title: "Ajustes",
    items: [
      {
        href: "/configuracion/parametros",
        label: "Parámetros comerciales",
        description: "IVA, servicio, garantía, vigencia, márgenes",
        icon: Percent,
        access: "manager",
      },
      {
        href: "/configuracion/hotel",
        label: "Datos del hotel",
        description: "Nombre, RIF, contacto y plantilla de cotización",
        icon: Building2,
        access: "manager",
      },
      {
        href: "/configuracion/tasa",
        label: "Tasa de cambio",
        description: "Tasa BCV y registro manual",
        icon: Coins,
        access: "manager",
      },
      {
        href: "/configuracion/usuarios",
        label: "Usuarios",
        description: "Cuentas, roles y accesos",
        icon: Users,
        access: "admin",
      },
    ],
  },
  {
    title: "Catálogo",
    items: [
      {
        href: "/configuracion/catalogo",
        label: "Productos",
        description: "Productos y servicios para cotizar eventos",
        icon: UtensilsCrossed,
        access: "all",
      },
      {
        href: "/configuracion/salones",
        label: "Salones",
        description: "Espacios para eventos del hotel",
        icon: Building2,
        access: "all",
      },
      {
        href: "/configuracion/catalogos",
        label: "Tipos y canales",
        description: "Tipos de evento y canales de ingreso",
        icon: Tags,
        access: "manager",
      },
    ],
  },
];

export function ConfigSidebar({
  isAdmin,
  isManager,
}: {
  isAdmin: boolean;
  isManager: boolean;
}) {
  const pathname = usePathname();
  const canSee = (a: Access) =>
    a === "all" || (a === "manager" && isManager) || (a === "admin" && isAdmin);

  return (
    <nav className="flex flex-col gap-4">
      {CONFIG_GROUPS.map((group) => {
        const items = group.items.filter((i) => canSee(i.access));
        if (items.length === 0) return null;
        return (
          <div key={group.title}>
            <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <div className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
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
                        active
                          ? "text-sky-700"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium leading-tight",
                          active && "text-sky-950"
                        )}
                      >
                        {item.label}
                      </p>
                      <p className="mt-0.5 hidden text-[11px] text-muted-foreground lg:block">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
