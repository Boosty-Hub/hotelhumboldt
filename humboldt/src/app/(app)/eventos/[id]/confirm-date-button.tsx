"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmEventDate } from "./actions";

export function ConfirmDateButton({
  eventId,
  startDateKey,
  altDates,
}: {
  eventId: string;
  startDateKey: string | null;
  altDates: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(startDateKey ?? "");
  const [pending, start] = useTransition();

  function confirm() {
    if (!date) {
      toast.error("Indicá la fecha definitiva del evento.");
      return;
    }
    start(async () => {
      const res = await confirmEventDate({ eventId, startDate: date });
      if (res.ok) {
        toast.success("Fecha confirmada.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-amber-300 text-amber-800 hover:bg-amber-50"
        onClick={() => setOpen(true)}
      >
        <CalendarCheck2 className="h-3.5 w-3.5" />
        Confirmar fecha
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar fecha del evento</DialogTitle>
            <DialogDescription>
              Fijá la fecha definitiva. Al confirmar, se quita la marca «fechas por confirmar».
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-date">Fecha del evento</Label>
            <Input
              id="confirm-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={pending}
            />
            {altDates && (
              <p className="text-xs text-muted-foreground">
                Fechas tentativas registradas: {altDates}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <CalendarCheck2 className="h-3.5 w-3.5" />}
              Confirmar fecha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
