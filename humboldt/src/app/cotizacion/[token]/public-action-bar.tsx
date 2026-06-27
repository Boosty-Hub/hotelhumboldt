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
import { approveQuotePublic, commentQuotePublic } from "./actions";

interface Props {
  token: string;
  /** Solo se muestra la barra si la cotización está ENVIADA y vigente. */
  actionable: boolean;
  totalUsd: number;
  depositAmount: number;
  signerName: string;
}

type OpenDialog = "approve" | "comment" | null;
type Result = { kind: "approved"; name: string } | { kind: "commented" } | null;

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
  const [commentNote, setCommentNote] = useState("");

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

  function submitComment() {
    if (commentNote.trim().length < 5) {
      toast.error("Escribe tu comentario (mínimo 5 caracteres)");
      return;
    }
    startTransition(async () => {
      const res = await commentQuotePublic(token, { note: commentNote.trim() });
      if (res.ok) {
        setOpen(null);
        setResult({ kind: "commented" });
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

  if (result?.kind === "commented") {
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
              onClick={() => setOpen("comment")}
              disabled={isPending}
              className="h-11 px-3 text-sm sm:px-5"
            >
              <MessageSquareText className="h-4 w-4" />
              <span className="hidden sm:inline">Dejar un comentario</span>
              <span className="sm:hidden">Comentar</span>
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

      {/* ── Diálogo: dejar un comentario (no es un rechazo) ───────── */}
      <Dialog open={open === "comment"} onOpenChange={(o) => !o && !isPending && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dejar un comentario</DialogTitle>
            <DialogDescription>
              Cuéntanos lo que quieras — dudas, ajustes de precios, menú, fechas o cualquier
              detalle. No rechaza la cotización: el equipo comercial verá tu comentario y te
              contactará.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="public-comment-note">
              Tu comentario <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="public-comment-note"
              value={commentNote}
              onChange={(e) => setCommentNote(e.target.value)}
              placeholder="Ej.: quisiéramos revisar el menú; consultar otra fecha; una duda sobre el total…"
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
              onClick={submitComment}
              disabled={isPending || commentNote.trim().length < 5}
              className="h-10 text-sm"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquareText className="h-4 w-4" />
              )}
              Enviar comentario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
