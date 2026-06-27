"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDayEs } from "@/lib/dates";
import { Building2, CalendarDays, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { generateBeoFromReservation } from "../actions";

export interface BeoReservationOption {
  id: string; // id de la reserva de salón confirmada
  name: string;
  clientName: string;
  spaceName: string;
  startDate: string | null;
  /** Número de cotización de origen, o "Reserva manual". */
  origin: string;
  pax: number | null;
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function GenerateBeoDialog({
  open,
  onOpenChange,
  reservations,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reservations: BeoReservationOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const q = norm(search.trim());
  const filtered = q
    ? reservations.filter(
        (e) =>
          norm(e.name).includes(q) ||
          norm(e.clientName).includes(q) ||
          norm(e.origin).includes(q) ||
          norm(e.spaceName).includes(q)
      )
    : reservations;

  function pick(reservationId: string) {
    startTransition(async () => {
      const res = await generateBeoFromReservation(reservationId);
      if (res.ok && res.id) {
        toast.success("BEO generado.");
        onOpenChange(false);
        router.push(`/beo/${res.id}`);
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar BEO desde una reserva confirmada</DialogTitle>
          <DialogDescription>
            Reservas de salón confirmadas que aún no tienen BEO — vengan de una cotización ganada
            o de una reserva manual. Al elegir una, se autocompleta el salón, la fecha, el cliente
            y el menú de la cotización vinculada (si la hay).
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar evento, cliente, salón o cotización…"
            className="pl-8"
          />
        </div>

        <div className="max-h-96 space-y-1.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No hay reservas confirmadas sin BEO.
            </p>
          ) : (
            filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                disabled={pending}
                onClick={() => pick(e.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{e.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {e.clientName} · {e.origin}
                    {e.pax ? ` · ${e.pax} pax` : ""}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Building2 className="size-3 shrink-0" />
                    {e.spaceName}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarDays className="size-3" />
                  {e.startDate ? formatDayEs(new Date(e.startDate), "dd/MM/yyyy") : "Sin fecha"}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
