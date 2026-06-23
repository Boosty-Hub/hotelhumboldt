"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronRight, Eye, FileText, Layers, Link2, Pencil, Trash2 } from "lucide-react";
import { fmtUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuoteStatusBadge } from "@/components/quote/quote-status-badge";
import { changeQuoteStatus, deleteQuote } from "../actions";

export interface QuoteRow {
  id: string;
  publicToken: string;
  baseNumber: string;
  version: number;
  clientName: string;
  clientLegal: string | null;
  eventName: string;
  eventDateLabel: string | null;
  issueDateLabel: string;
  validityText: string;
  validityClass: string;
  totalUsd: number;
  status: string;
  signerName: string;
}

export interface QuoteGroup {
  baseNumber: string;
  versions: QuoteRow[]; // orden: versión más reciente primero
}

/**
 * Acción de estado inline desde la lista: según el estado actual ofrece el
 * siguiente paso natural (Borrador → Enviar, Enviada/Vencida → Aprobar).
 * Usa changeQuoteStatus, que valida las transiciones permitidas.
 */
function StatusAction({
  id,
  status,
  publicToken,
}: {
  id: string;
  status: string;
  publicToken: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const next =
    status === "BORRADOR"
      ? { to: "ENVIADA", label: "Enviar", ok: "Cotización marcada como enviada.", className: "border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800" }
      : status === "ENVIADA" || status === "VENCIDA"
        ? { to: "APROBADA", label: "Aprobar", ok: "Cotización aprobada.", className: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" }
        : null;
  if (!next) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      className={cn("h-6 gap-1 px-1.5", next.className)}
      onClick={() =>
        start(async () => {
          const res = await changeQuoteStatus(id, next.to);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(next.ok);
          // Al enviar, copiamos el link público listo para compartir.
          if (next.to === "ENVIADA") {
            try {
              await navigator.clipboard.writeText(
                `${window.location.origin}/cotizacion/${publicToken}`
              );
              toast.success("Link público copiado — pegalo en WhatsApp o correo.");
            } catch {
              toast.message("Cotización enviada. Copiá el link público desde la cotización.");
            }
          }
          router.refresh();
        })
      }
    >
      <Check className="size-3" />
      {next.label}
    </Button>
  );
}

/** Copia el link público /cotizacion/{token} al portapapeles (versión compacta para la fila). */
function ShareLinkButton({ publicToken }: { publicToken: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label="Copiar link para compartir"
      title="Copiar link para compartir"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(
            `${window.location.origin}/cotizacion/${publicToken}`
          );
          setCopied(true);
          toast.success("Link público copiado — pegalo en WhatsApp o correo.");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("No se pudo copiar el link.");
        }
      }}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Link2 className="h-3 w-3" />}
    </Button>
  );
}

/** Borra la cotización tras confirmación. La validación de seguridad vive en el server action. */
function DeleteQuoteButton({
  id,
  baseNumber,
  version,
}: {
  id: string;
  baseNumber: string;
  version: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  const label = version > 1 ? `${baseNumber} v${version}` : baseNumber;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Borrar cotización"
        title="Borrar cotización"
        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-rose-600" />
              Borrar cotización
            </DialogTitle>
            <DialogDescription>
              Vas a borrar <span className="font-medium text-foreground">«{label}»</span>. Esta
              acción no se puede deshacer. Si tiene pagos o facturas asociados, se bloqueará.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteQuote(id);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Cotización eliminada.");
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Borrando…" : "Borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RowActions({ row, canDelete }: { row: QuoteRow; canDelete: boolean }) {
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href={`/cotizaciones/${row.id}/editar`} aria-label="Editar cotización">
          <Pencil className="h-3 w-3" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href={`/cotizaciones/${row.id}`} aria-label="Ver documento">
          <Eye className="h-3 w-3" />
        </Link>
      </Button>
      <ShareLinkButton publicToken={row.publicToken} />
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href={`/cotizaciones/${row.id}?print=1`} aria-label="PDF / Imprimir" title="PDF / Imprimir">
          <FileText className="h-3 w-3" />
        </Link>
      </Button>
      {canDelete && (
        <DeleteQuoteButton id={row.id} baseNumber={row.baseNumber} version={row.version} />
      )}
    </div>
  );
}

export function QuotesTable({
  groups,
  canDelete,
}: {
  groups: QuoteGroup[];
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (base: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(base)) next.delete(base);
      else next.add(base);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Fecha evento</TableHead>
            <TableHead>Emisión</TableHead>
            <TableHead>Vigencia</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Firmante</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const latest = group.versions[0];
            const olderCount = group.versions.length - 1;
            const isOpen = expanded.has(group.baseNumber);
            return (
              <React.Fragment key={group.baseNumber}>
                {/* Fila principal: versión más reciente */}
                <TableRow className="group">
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {olderCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggle(group.baseNumber)}
                          aria-label={isOpen ? "Ocultar versiones" : "Ver versiones"}
                          aria-expanded={isOpen}
                          className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight
                            className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
                          />
                        </button>
                      ) : (
                        <span className="size-4 shrink-0" />
                      )}
                      <Link
                        href={`/cotizaciones/${latest.id}/editar`}
                        className="flex items-center gap-1.5 font-medium text-sky-950 hover:underline dark:text-sky-200"
                      >
                        {group.baseNumber}
                        {latest.version > 1 && (
                          <Badge variant="outline" className="text-[10px]">
                            v{latest.version}
                          </Badge>
                        )}
                      </Link>
                      {olderCount > 0 && (
                        <button
                          type="button"
                          onClick={() => toggle(group.baseNumber)}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                          title="Ver todas las versiones"
                        >
                          <Layers className="size-2.5" />
                          {group.versions.length} versiones
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-44 truncate font-medium">{latest.clientName}</p>
                    {latest.clientLegal && (
                      <p className="max-w-44 truncate text-xs text-muted-foreground">
                        {latest.clientLegal}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48">
                    <p className="truncate">{latest.eventName}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {latest.eventDateLabel ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{latest.issueDateLabel}</TableCell>
                  <TableCell>
                    <span className={cn("text-sm", latest.validityClass)}>{latest.validityText}</span>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtUsd(latest.totalUsd)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <QuoteStatusBadge status={latest.status} />
                      <StatusAction
                        id={latest.id}
                        status={latest.status}
                        publicToken={latest.publicToken}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{latest.signerName}</TableCell>
                  <TableCell>
                    <RowActions row={latest} canDelete={canDelete} />
                  </TableCell>
                </TableRow>

                {/* Versiones anteriores (desplegables) */}
                {isOpen &&
                  group.versions.slice(1).map((v) => (
                    <TableRow key={v.id} className="group bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-1.5 pl-5">
                          <Link
                            href={`/cotizaciones/${v.id}/editar`}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {group.baseNumber}
                            <Badge variant="outline" className="text-[10px]">
                              v{v.version}
                            </Badge>
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.clientName}</TableCell>
                      <TableCell className="max-w-48">
                        <p className="truncate text-xs text-muted-foreground">{v.eventName}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {v.eventDateLabel ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{v.issueDateLabel}</TableCell>
                      <TableCell>
                        <span className={cn("text-sm", v.validityClass)}>{v.validityText}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmtUsd(v.totalUsd)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <QuoteStatusBadge status={v.status} />
                          <StatusAction id={v.id} status={v.status} publicToken={v.publicToken} />
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{v.signerName}</TableCell>
                      <TableCell>
                        <RowActions row={v} canDelete={canDelete} />
                      </TableCell>
                    </TableRow>
                  ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
