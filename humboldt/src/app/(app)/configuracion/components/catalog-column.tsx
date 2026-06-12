"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ListPlus, Loader2, Pencil, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createCatalogOptionAction,
  renameCatalogOptionAction,
  toggleCatalogOptionAction,
} from "../actions";
import type { CatalogItem, CatalogKind } from "../types";

interface CatalogColumnProps {
  kind: CatalogKind;
  title: string;
  description: string;
  items: CatalogItem[];
}

/** Columna de catálogo (tipos de evento / canales): agregar, renombrar, activar. */
export function CatalogColumn({ kind, title, description, items }: CatalogColumnProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createCatalogOptionAction({ kind, name: newName });
      if (res.ok) {
        toast.success(res.message ?? "Opción agregada.");
        setNewName("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleRename(id: string) {
    startTransition(async () => {
      const res = await renameCatalogOptionAction({ kind, id, name: editName });
      if (res.ok) {
        toast.success(res.message ?? "Opción renombrada.");
        setEditingId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleToggle(item: CatalogItem, active: boolean) {
    startTransition(async () => {
      const res = await toggleCatalogOptionAction({ kind, id: item.id, active });
      if (res.ok) toast.success(`«${item.name}» ${active ? "activado" : "desactivado"}.`);
      else toast.error(res.error);
    });
  }

  const activeCount = items.filter((i) => i.active).length;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description} {activeCount} de {items.length} opciones activas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Agregar ${kind === "eventType" ? "tipo de evento" : "canal"}…`}
            disabled={pending}
            aria-label={`Nuevo ${title}`}
          />
          <Button type="submit" disabled={pending || !newName.trim()}>
            <Plus data-icon="inline-start" />
            Agregar
          </Button>
        </form>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <ListPlus className="size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">Sin opciones todavía</p>
            <p className="text-xs text-muted-foreground">
              Agrega la primera opción con el campo de arriba.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                {editingId === item.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      disabled={pending}
                      className="h-7"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleRename(item.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      aria-label={`Renombrar ${item.name}`}
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleRename(item.id)}
                      disabled={pending || !editName.trim()}
                      aria-label="Guardar nombre"
                    >
                      {pending ? <Loader2 className="animate-spin" /> : <Check />}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      disabled={pending}
                      aria-label="Cancelar"
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        item.active ? "" : "text-muted-foreground line-through decoration-muted-foreground/40"
                      }`}
                    >
                      {item.name}
                    </span>
                    {!item.active && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                      }}
                      disabled={pending}
                      aria-label={`Renombrar ${item.name}`}
                    >
                      <Pencil />
                    </Button>
                    <Switch
                      size="sm"
                      checked={item.active}
                      disabled={pending}
                      onCheckedChange={(checked) => handleToggle(item, checked)}
                      aria-label={`Activar o desactivar ${item.name}`}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
