"use client";

// Barra de acciones sticky del link público + diálogos de decisión y
// pantallas de confirmación. Se monta SIEMPRE (aunque la cotización ya no
// sea accionable) para que la pantalla de confirmación sobreviva al
// router.refresh() posterior a la mutación.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { fmtUsd } from "@/lib/money";
import {
  CheckCircle2,
  Check,
  Loader2,
  MessageSquareText,
  MailCheck,
} from "lucide-react";
import { approveQuotePublic, rejectQuotePublic } from "./actions";

interface Props {
  token: string;
  /** Solo se muestra la barra si la cotización está ENVIADA y vigente. */
  actionable: boolean;
  totalUsd: number;
  depositAmount: number;
  signerName: string;
}

type OpenDialog = "approve" | "reject" | null;
type Result = { kind: "approved"; name: string } | { kind: "rejected" } | null;

export function PublicActionBar({
  token,
  actionable,
  totalUsd,
  depositAmount,
  signerName,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState<OpenDialog>(null);
  const [result, setResult] = useState<Result>(null);

  const [approverName, setApproverName] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  function submitApprove() {
    if (approverName.trim().length < 3) {
      toast.error("Indica el nombre completo de quien aprueba");
      return;
    }
    startTransition(async () => {
      const res = await approveQuotePublic(token, {
        approverName: approverName.trim(),
        note: approveNote.trim() || undefined,
      });
      if (res.ok) {
        setOpen(null);
        setResult({ kind: "approved", name: approverName.trim() });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function submitReject() {
    if (rejectNote.trim().length < 5) {
      toast.error("Cuéntanos qué te gustaría ajustar (mínimo 5 caracteres)");
      return;
    }
    startTransition(async () => {
      const res = await rejectQuotePublic(token, { note: rejectNote.trim() });
      if (res.ok) {
        setOpen(null);
        setResult({ kind: "rejected" });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // ── Pantallas de confirmación (cubren toda la vista) ──────────────
  if (result?.kind === "approved") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-white px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50">
          <Check className="h-10 w-10 text-emerald-600" strokeWidth={2.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            ¡Cotización aprobada!
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-zinc-500">
            Gracias, {result.name}. Registramos tu aprobación y{" "}
            <span className="font-medium text-zinc-700">{signerName}</span> se pondrá en
            contacto contigo muy pronto para coordinar los próximos pasos. Será un placer
            recibirte a 2.105 metros sobre Caracas.
          </p>
        </div>
        <Button
          onClick={() => setResult(null)}
          className="h-10 px-6 text-sm"
        >
          Ver la cotización
        </Button>
      </div>
    );
  }

  if (result?.kind === "rejected") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-white px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 ring-8 ring-sky-50">
          <MailCheck className="h-9 w-9 text-sky-700" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Recibimos tus comentarios
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-zinc-500">
            Gracias por tu respuesta.{" "}
            <span className="font-medium text-zinc-700">{signerName}</span> y el equipo
            comercial del Hotel Humboldt revisarán tu solicitud y te contactarán a la
            brevedad con una propuesta ajustada.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setResult(null)}
          className="h-10 px-6 text-sm"
        >
          Volver al documento
        </Button>
      </div>
    );
  }

  if (!actionable) return null;

  return (
    <>
      {/* ── Barra sticky inferior ──────────────────────────────────── */}
      <div className="print-hidden fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Total del evento
            </p>
            <p className="text-lg font-bold tabular-nums leading-tight text-sky-950">
              {fmtUsd(totalUsd)}
            </p>
            {depositAmount > 0 && (
              <p className="hidden text-[11px] text-zinc-400 sm:block">
                + {fmtUsd(depositAmount)} de garantía reembolsable
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen("reject")}
              disabled={isPending}
              className="h-11 px-3 text-sm sm:px-5"
            >
              <MessageSquareText className="h-4 w-4" />
              <span className="hidden sm:inline">Solicitar cambios</span>
              <span className="sm:hidden">Cambios</span>
            </Button>
            <Button
              onClick={() => setOpen("approve")}
              disabled={isPending}
              className="h-11 bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 sm:px-6"
            >
              <CheckCircle2 className="h-4 w-4" />
              Aprobar cotización
            </Button>
          </div>
        </div>
      </div>

      {/* ── Diálogo: aprobar ──────────────────────────────────────── */}
      <Dialog open={open === "approve"} onOpenChange={(o) => !o && !isPending && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aprobar cotización</DialogTitle>
            <DialogDescription>
              Al aprobar confirmas tu acuerdo con los servicios y montos descritos.{" "}
              {signerName} te contactará para coordinar la reserva.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-500">Total del evento</span>
              <span className="font-bold tabular-nums text-sky-950">{fmtUsd(totalUsd)}</span>
            </div>
            {depositAmount > 0 && (
              <div className="mt-1 flex items-baseline justify-between text-xs">
                <span className="text-zinc-400">Garantía reembolsable (depósito aparte)</span>
                <span className="font-medium tabular-nums text-zinc-500">
                  {fmtUsd(depositAmount)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="public-approver">
              Nombre y apellido de quien aprueba <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="public-approver"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              placeholder="Ej.: María Fernández"
              autoComplete="name"
              maxLength={120}
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="public-approve-note">Nota para el equipo (opcional)</Label>
            <Textarea
              id="public-approve-note"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Ej.: confirmamos el menú propuesto; coordinar degustación…"
              rows={3}
              maxLength={1000}
              className="text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(null)}
              disabled={isPending}
              className="h-10 text-sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={submitApprove}
              disabled={isPending || approverName.trim().length < 3}
              className="h-10 bg-emerald-600 text-sm text-white hover:bg-emerald-700"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Aprobar cotización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: solicitar cambios / rechazar ─────────────────── */}
      <Dialog open={open === "reject"} onOpenChange={(o) => !o && !isPending && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar cambios</DialogTitle>
            <DialogDescription>
              Cuéntanos qué te gustaría ajustar — precios, menú, fechas o cualquier
              detalle. El equipo comercial te contactará con una propuesta actualizada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="public-reject-note">
              ¿Qué te gustaría cambiar? <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="public-reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Ej.: el presupuesto excede lo previsto; quisiéramos otra fecha; cambiar el menú…"
              rows={4}
              maxLength={2000}
              className="text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(null)}
              disabled={isPending}
              className="h-10 text-sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={submitReject}
              disabled={isPending || rejectNote.trim().length < 5}
              className="h-10 text-sm"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquareText className="h-4 w-4" />
              )}
              Enviar comentarios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
