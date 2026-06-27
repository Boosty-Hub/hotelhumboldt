"use client";

import { CalendarDays, Table2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarTimeline } from "./calendar-timeline";
import { EventsTable } from "./events-table";
import type {
  CalendarSpaceDTO,
  ConflictDTO,
  ContactOptionDTO,
  OpenQuoteOptionDTO,
  ReservationDTO,
} from "./types";

interface CalendarTabsProps {
  month: string; // yyyy-MM
  spaces: CalendarSpaceDTO[];
  /** Reservas del mes visible — alimentan la línea de tiempo. */
  reservations: ReservationDTO[];
  conflicts: ConflictDTO[];
  contacts: ContactOptionDTO[];
  openQuotes: OpenQuoteOptionDTO[];
  showCancelled: boolean;
  /** Todas las reservas-evento (cualquier mes) — alimentan la tabla. */
  allReservations: ReservationDTO[];
}

/**
 * Dos vistas del mismo dato (una reserva de salón = un evento):
 *  • Calendario — línea de tiempo de salones por día (mes navegable).
 *  • Eventos — tabla con todos los eventos por salón, filtrable.
 *
 * Las pestañas son cliente y no recargan: cambiar de pestaña no vuelve a pedir
 * datos al servidor. La navegación de mes (dentro de Calendario) sí navega.
 */
export function CalendarTabs({ allReservations, spaces, ...calendar }: CalendarTabsProps) {
  return (
    <Tabs defaultValue="calendario" className="gap-4">
      <TabsList>
        <TabsTrigger value="calendario">
          <CalendarDays />
          Calendario
        </TabsTrigger>
        <TabsTrigger value="eventos">
          <Table2 />
          Eventos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calendario">
        <CalendarTimeline spaces={spaces} {...calendar} />
      </TabsContent>

      <TabsContent value="eventos">
        <EventsTable reservations={allReservations} spaces={spaces} />
      </TabsContent>
    </Tabs>
  );
}
