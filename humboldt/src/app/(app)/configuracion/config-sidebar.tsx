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
      { href: "/configuracion/parametros", label: "Parámetros", icon: Percent, access: "manager" },
      { href: "/configuracion/hotel", label: "Datos del hotel", icon: Building2, access: "manager" },
      { href: "/configuracion/tasa", label: "Tasa de cambio", icon: Coins, access: "manager" },
      { href: "/configuracion/usuarios", label: "Usuarios", icon: Users, access: "admin" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/configuracion/catalogo", label: "Productos", icon: UtensilsCrossed, access: "all" },
      { href: "/configuracion/salones", label: "Salones", icon: Building2, access: "all" },
      { href: "/configuracion/catalogos", label: "Tipos y canales", icon: Tags, access: "manager" },
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
    <nav className="space-y-5">
      {CONFIG_GROUPS.map((group) => {
        const items = group.items.filter((i) => canSee(i.access));
        if (items.length === 0) return null;
        return (
          <div key={group.title}>
            <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
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
                      <Icon className="h-4 w-4 shrink-0" />
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
  );
}
