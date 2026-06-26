"use client";

// Selector de fecha con calendario, drop-in de <input type="date">.
//
// Por qué existe: un <input type="date"> nativo muestra el formato según el
// locale del NAVEGADOR (no se puede forzar). Este componente garantiza dd/MM/yyyy
// para todos los usuarios. Mantiene el MISMO contrato que el input nativo: el
// value es un string "yyyy-MM-dd", así que la lógica de guardado/filtrado (y la
// convención de medianoche UTC en BD) no cambia — solo la presentación.

import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { type Matcher } from "react-day-picker";
import { CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DatePickerProps {
  /** Fecha en formato yyyy-MM-dd ("" si no hay). */
  value: string;
  /** Recibe la fecha elegida en yyyy-MM-dd ("" al limpiar). */
  onChange: (value: string) => void;
  /** Mínimo seleccionable (yyyy-MM-dd). */
  min?: string;
  /** Máximo seleccionable (yyyy-MM-dd). */
  max?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Muestra una "X" para vaciar la fecha (campos opcionales / filtros). */
  clearable?: boolean;
  "aria-label"?: string;
}

/** Parsea "yyyy-MM-dd" a Date local; undefined si vacío o inválido. */
function toDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = parseISO(s);
  return isValid(d) ? d : undefined;
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  id,
  disabled,
  className,
  placeholder = "dd/mm/aaaa",
  clearable = false,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);

  const disabledMatcher: Matcher[] = [];
  if (minDate) disabledMatcher.push({ before: minDate });
  if (maxDate) disabledMatcher.push({ after: maxDate });

  const showClear = clearable && Boolean(selected) && !disabled;

  return (
    <div className={cn("relative inline-flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              "flex h-7 w-full items-center gap-2 rounded-md border border-input bg-input/20 px-2 py-0.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
              !selected && "text-muted-foreground",
              showClear && "pr-7"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-left">
              {selected ? format(selected, "dd/MM/yyyy") : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={es}
            selected={selected}
            defaultMonth={selected ?? minDate}
            disabled={disabledMatcher.length ? disabledMatcher : undefined}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {showClear && (
        <button
          type="button"
          aria-label="Limpiar fecha"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
