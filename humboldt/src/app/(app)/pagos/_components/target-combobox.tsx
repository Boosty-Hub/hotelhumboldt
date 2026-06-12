"use client";

// Combobox de cotización / oportunidad para los diálogos de pago y factura.

import * as React from "react";
import { Check, ChevronsUpDown, FileText, KanbanSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/money";
import type { TargetOption } from "../types";

export function TargetCombobox({
  targets,
  value,
  onChange,
  disabled,
}: {
  targets: TargetOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = targets.find((t) => t.value === value) ?? null;

  const quotes = targets.filter((t) => t.kind === "QUOTE");
  const opps = targets.filter((t) => t.kind === "OPP");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-1.5">
              {selected.kind === "QUOTE" ? (
                <FileText className="size-3.5 shrink-0 text-sky-700" />
              ) : (
                <KanbanSquare className="size-3.5 shrink-0 text-violet-700" />
              )}
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Buscar cotización u oportunidad…</span>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-96 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por número, cliente o evento…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {quotes.length > 0 && (
              <CommandGroup heading="Cotizaciones aprobadas / contratadas">
                {quotes.map((t) => (
                  <CommandItem
                    key={t.value}
                    value={`${t.label} ${t.sublabel}`}
                    onSelect={() => {
                      onChange(t.value === value ? null : t.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-3.5",
                        value === t.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.label}</p>
                      <p className="truncate text-muted-foreground">{t.sublabel}</p>
                    </div>
                    {t.totalUsd != null && (
                      <span className="ml-2 shrink-0 font-mono text-muted-foreground">
                        {fmtUsd(t.totalUsd)}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {opps.length > 0 && (
              <CommandGroup heading="Oportunidades sin cotización aprobada">
                {opps.map((t) => (
                  <CommandItem
                    key={t.value}
                    value={`${t.label} ${t.sublabel}`}
                    onSelect={() => {
                      onChange(t.value === value ? null : t.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-3.5",
                        value === t.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{t.label}</p>
                      <p className="truncate text-muted-foreground">{t.sublabel}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
