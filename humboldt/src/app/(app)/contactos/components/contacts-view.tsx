"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Mail, Phone, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewContactDialog } from "./new-contact-dialog";

export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  clientId: string;
  clientName: string;
}

export interface ClientLite {
  id: string;
  name: string;
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function ContactsView({
  contacts,
  clients,
}: {
  contacts: ContactRow[];
  clients: ClientLite[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const q = norm(search.trim());
  const filtered = q
    ? contacts.filter(
        (c) =>
          norm(c.name).includes(q) ||
          norm(c.clientName).includes(q) ||
          norm(c.title ?? "").includes(q) ||
          norm(c.email ?? "").includes(q) ||
          norm(c.phone ?? "").includes(q)
      )
    : contacts;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contactos</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"} · personas a las que
            les cotizamos
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-sky-950 hover:bg-sky-900">
          <UserPlus data-icon="inline-start" />
          Agregar contacto
        </Button>
      </div>

      <div className="relative w-full max-w-72">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, cliente, correo…"
          className="pl-8"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {contacts.length === 0
                ? "Todavía no hay contactos. Agregá el primero con el botón de arriba."
                : "Ningún contacto coincide con la búsqueda."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Datos</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
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
                      <Link
                        href={`/clientes/${c.clientId}`}
                        className="text-sm font-medium text-sky-900 hover:underline"
                      >
                        {c.clientName}
                      </Link>
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
                        <Link href={`/cotizaciones/nueva?cliente=${c.clientId}`}>
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
