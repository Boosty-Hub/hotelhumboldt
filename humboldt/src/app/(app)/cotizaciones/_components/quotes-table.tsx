"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, Eye, FileText, Layers, Link2, MessageSquareText, Pencil, Trash2 } from "lucide-react";
import { fmtUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from "@/lib/constants";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QuoteStatusBadge } from "@/components/quote/quote-status-badge";
import { changeQuoteStatus, deleteQuote, markQuoteCommentRead } from "../actions";

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
  /** Comentario del cliente desde el link público (si lo hay). */
  clientComment: string | null;
  clientCommentAt: string | null;
  /** El comentario aún no fue leído por el ejecutivo (badge en el listado). */
  commentUnread: boolean;
}

export interface QuoteGroup {
  baseNumber: string;
  versions: QuoteRow[]; // orden: versión más reciente primero
}

/**
 * Estado de la cotización como dropdown: el badge actual abre un menú con TODOS
 * los demás estados (a veces se crea la cotización y se aprueba/contrata de una
 * vez porque el cliente ya la aceptó). El servidor valida el resto de reglas
 * (no aprobar una cotización vacía, etc.). Al pasar a ENVIADA copia el link.
 */
function StatusSelect({
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

  const targets = QUOTE_STATUSES.filter((s) => s !== status);
  if (targets.length === 0) return <QuoteStatusBadge status={status} />;

  const apply = (to: QuoteStatus) =>
    start(async () => {
      const res = await changeQuoteStatus(id, to);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Cotización marcada como ${QUOTE_STATUS_LABELS[to].toLowerCase()}.`);
      // Al enviar, copiamos el link público listo para compartir.
      if (to === "ENVIADA") {
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
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={pending}>
        <button
          type="button"
          aria-label="Cambiar estado"
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50",
            QUOTE_STATUS_COLORS[status as QuoteStatus] ?? ""
          )}
        >
          {QUOTE_STATUS_LABELS[status as QuoteStatus] ?? status}
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {targets.map((to) => (
          <DropdownMenuItem key={to} onSelect={() => apply(to)} className="text-xs">
            <span
              className={cn(
                "size-2 rounded-full border",
                QUOTE_STATUS_COLORS[to] ?? ""
              )}
              aria-hidden
            />
            {QUOTE_STATUS_LABELS[to]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Indicador de comentario del cliente: ícono con badge contador cuando hay un
 * comentario sin leer. Al abrir el popover muestra el comentario y lo marca
 * como leído (limpia el badge).
 */
function CommentIndicator({
  id,
  comment,
  at,
  unread,
}: {
  id: string;
  comment: string;
  at: string | null;
  unread: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [, start] = React.useTransition();
  const markedRef = React.useRef(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && unread && !markedRef.current) {
      markedRef.current = true;
      start(async () => {
        await markQuoteCommentRead(id);
        router.refresh();
      });
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label="Comentario del cliente"
          title="Comentario del cliente"
        >
          <MessageSquareText
            className={cn("h-3.5 w-3.5", unread ? "text-orange-600" : "text-muted-foreground")}
          />
          {unread && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold leading-none text-white">
              1
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Comentario del cliente{at ? ` · ${at}` : ""}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{comment}</p>
      </PopoverContent>
    </Popover>
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
                    <div className="flex items-center gap-1">
                      <StatusSelect
                        id={latest.id}
                        status={latest.status}
                        publicToken={latest.publicToken}
                      />
                      {latest.clientComment && (
                        <CommentIndicator
                          id={latest.id}
                          comment={latest.clientComment}
                          at={latest.clientCommentAt}
                          unread={latest.commentUnread}
                        />
                      )}
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
                        <div className="flex items-center gap-1">
                          <StatusSelect id={v.id} status={v.status} publicToken={v.publicToken} />
                          {v.clientComment && (
                            <CommentIndicator
                              id={v.id}
                              comment={v.clientComment}
                              at={v.clientCommentAt}
                              unread={v.commentUnread}
                            />
                          )}
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
