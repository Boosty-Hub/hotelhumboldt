"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Mail, Phone, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { NewContactDialog } from "./new-contact-dialog";

export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  /** ¿Es principal de alguna empresa? */
  isPrimary: boolean;
  /** Empresas a las que pertenece (puede ser ninguna o varias). */
  clients: { id: string; name: string }[];
}

export interface ClientLite {
  id: string;
  name: string;
}

export function ContactsView({
  contacts,
  clients,
  total,
  filtered,
  onlyPrimary,
  hasFilters,
}: {
  contacts: ContactRow[];
  clients: ClientLite[];
  /** Total de contactos sin filtros (para el contador del encabezado). */
  total: number;
  /** Cantidad de contactos tras aplicar los filtros (para "X de Y"). */
  filtered: number;
  /** Filtro "solo principales" activo. */
  onlyPrimary: boolean;
  /** ¿Hay algún filtro activo? Distingue "sin contactos" de "sin coincidencias". */
  hasFilters: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // Solo el switch "principales" es propio de esta vista; búsqueda y orden los
  // maneja ListFilters. Lee la URL viva para no pisar al otro escritor.
  function apply(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contactos</h1>
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? `${filtered} de ${total} ${total === 1 ? "contacto" : "contactos"}`
              : `${total} ${total === 1 ? "contacto" : "contactos"}`}{" "}
            · personas a las que les cotizamos
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-sky-950 hover:bg-sky-900">
          <UserPlus data-icon="inline-start" />
          Agregar contacto
        </Button>
      </div>

      <ListFilters
        searchPlaceholder="Buscar por nombre, cliente, correo…"
        searchAriaLabel="Buscar contactos"
        direction={{ ascLabel: "Nombre (A–Z)", descLabel: "Nombre (Z–A)", defaultDir: "asc" }}
        extraParams={["principales"]}
      >
        <div className="flex items-center gap-2">
          <Switch
            id="principales"
            checked={onlyPrimary}
            onCheckedChange={(checked) => apply({ principales: checked ? "1" : null })}
          />
          <Label htmlFor="principales" className="text-xs text-muted-foreground">
            Solo principales
          </Label>
        </div>
      </ListFilters>

      <Card>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {hasFilters
                ? "Ningún contacto coincide con los filtros."
                : "Todavía no hay contactos. Agregá el primero con el botón de arriba."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Empresas</TableHead>
                  <TableHead>Datos</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{c.name}</span>
                        {c.isPrimary && (
                          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                            Principal
                          </Badge>
                        )}
                      </div>
                      {c.title && <p className="text-[11px] text-muted-foreground">{c.title}</p>}
                    </TableCell>
                    <TableCell>
                      {c.clients.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin empresa</span>
                      ) : (
                        <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                          {c.clients.map((cl, i) => (
                            <span key={cl.id} className="text-sm">
                              <Link
                                href={`/clientes/${cl.id}`}
                                className="font-medium text-sky-900 hover:underline"
                              >
                                {cl.name}
                              </Link>
                              {i < c.clients.length - 1 && (
                                <span className="text-muted-foreground">,</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" />
                            {c.phone}
                          </span>
                        )}
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="size-3" />
                            {c.email}
                          </span>
                        )}
                        {!c.phone && !c.email && <span>—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/cotizaciones/nueva?contacto=${c.id}`}>
                          <FileText data-icon="inline-start" />
                          Crear cotización
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewContactDialog open={open} onOpenChange={setOpen} clients={clients} />
    </div>
  );
}
