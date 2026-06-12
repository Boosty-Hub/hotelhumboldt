"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, PencilLine } from "lucide-react";
import { fmtUsd } from "@/lib/money";
import type { CatalogProduct } from "./quote-utils";

interface Props {
  catalog: CatalogProduct[];
  onSelect: (product: CatalogProduct) => void;
  onFreeLine: () => void;
  disabled?: boolean;
}

/** Combobox buscable del catálogo, agrupado por categoría. */
export function ProductCombobox({ catalog, onSelect, onFreeLine, disabled }: Props) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const byCategory = new Map<string, CatalogProduct[]>();
    for (const p of catalog) {
      const key = p.categoryName || "Sin categoría";
      const arr = byCategory.get(key);
      if (arr) arr.push(p);
      else byCategory.set(key, [p]);
    }
    return [...byCategory.entries()];
  }, [catalog]);

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled} type="button">
            <Plus className="h-3 w-3" />
            Agregar producto
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar en el catálogo…" autoFocus />
            <CommandList>
              <CommandEmpty>Sin resultados en el catálogo.</CommandEmpty>
              {groups.map(([category, products]) => (
                <CommandGroup key={category} heading={category}>
                  {products.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${category}`}
                      onSelect={() => {
                        onSelect(p);
                        setOpen(false);
                      }}
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="ml-2 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {p.type === "COMODIN" || p.listPrice == null ? (
                          <span className="italic">precio manual</span>
                        ) : (
                          <>
                            {fmtUsd(p.listPrice)}
                            <span className="ml-1 lowercase">/ {p.unit.toLowerCase()}</span>
                          </>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="sm" onClick={onFreeLine} disabled={disabled} type="button">
        <PencilLine className="h-3 w-3" />
        Línea libre
      </Button>
    </div>
  );
}
