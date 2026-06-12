"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { deleteCategory, moveCategory, saveCategory } from "./actions";
import type { CategoryRow } from "./catalog-shared";

interface CategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryRow[];
}

export function CategoriesDialog({ open, onOpenChange, categories }: CategoriesDialogProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await saveCategory({ name });
      if (res.ok) {
        toast.success("Categoría creada");
        setNewName("");
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleRename = (id: string) => {
    const name = draftName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await saveCategory({ id, name });
      if (res.ok) {
        toast.success("Categoría renombrada");
        setEditingId(null);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleMove = (id: string, direction: "up" | "down") => {
    startTransition(async () => {
      const res = await moveCategory(id, direction);
      if (!res.ok) toast.error(res.error);
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const res = await deleteCategory(target.id);
      if (res.ok) toast.success(`Categoría «${target.name}» eliminada`);
      else toast.error(res.error);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" />
              Categorías del catálogo
            </DialogTitle>
            <DialogDescription>
              Cree, renombre o reordene las categorías. El orden se refleja en los listados.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva categoría…"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <Button onClick={handleCreate} disabled={pending || !newName.trim()}>
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>

          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {categories.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Aún no hay categorías. Cree la primera arriba.
              </p>
            )}
            {categories.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5"
              >
                {editingId === c.id ? (
                  <>
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="h-6 flex-1"
                      maxLength={80}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleRename(c.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleRename(c.id)}
                      disabled={pending}
                      title="Guardar"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      title="Cancelar"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-xs font-medium">{c.name}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {c.productCount}
                    </Badge>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={pending || i === 0}
                      onClick={() => handleMove(c.id, "up")}
                      title="Subir"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={pending || i === categories.length - 1}
                      onClick={() => handleMove(c.id, "down")}
                      title="Bajar"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(c.id);
                        setDraftName(c.name);
                      }}
                      title="Renombrar"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      disabled={pending || c.productCount > 0}
                      onClick={() => setDeleting(c)}
                      title={
                        c.productCount > 0
                          ? "No se puede eliminar: tiene productos"
                          : "Eliminar"
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la categoría «{deleting?.name}». Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
