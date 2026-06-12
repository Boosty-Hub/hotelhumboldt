import { prisma } from "@/lib/prisma";
import { SuppliersGrid } from "./suppliers-grid";
import { SuppliersHeaderActions } from "./suppliers-header-actions";

export const metadata = { title: "Proveedores" };

export default async function ProveedoresPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  const rows = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    serviceType: s.serviceType,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    discountPct: s.discountPct,
    appliesIva: s.appliesIva,
    conditions: s.conditions,
    active: s.active,
    productCount: s._count.products,
  }));

  const activos = rows.filter((s) => s.active).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            Servicios externos para eventos · {activos}{" "}
            {activos === 1 ? "activo" : "activos"} de {rows.length}
          </p>
        </div>
        <SuppliersHeaderActions />
      </div>

      <SuppliersGrid suppliers={rows} />
    </div>
  );
}
