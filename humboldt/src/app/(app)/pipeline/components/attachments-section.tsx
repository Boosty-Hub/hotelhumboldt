"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, FileText, ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  type AttachmentDTO,
} from "../attachment-actions";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({ opportunityId }: { opportunityId: string }) {
  const [items, setItems] = useState<AttachmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const rows = await listAttachments(opportunityId);
    setItems(rows);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("opportunityId", opportunityId);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadAttachment(fd);
      if (res.ok) {
        toast.success("Archivo subido.");
        await reload();
      } else {
        toast.error(res.error);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    startTransition(async () => {
      const res = await deleteAttachment(id);
      if (res.ok) {
        toast.success("Adjunto eliminado.");
        await reload();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Paperclip className="size-3" />
          Documentos del evento
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
          Subir archivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={onPick}
        />
      </div>

      {loading ? (
        <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
          Cargando documentos…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
          Sin documentos. Adjuntá fotos, PDF o contratos (máx. 15 MB).
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => {
            const isImg = a.mimeType.startsWith("image/");
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {isImg ? (
                    <ImageIcon className="size-3.5 shrink-0 text-sky-700" />
                  ) : (
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{a.fileName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {fmtBytes(a.size)} · {a.uploadedByName}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button variant="ghost" size="icon-sm" asChild aria-label="Descargar">
                    <a href={`/api/adjuntos/${a.id}`} target="_blank" rel="noopener noreferrer">
                      <Download className="size-3.5" />
                    </a>
                  </Button>
                  {a.canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending}
                      onClick={() => onDelete(a.id, a.fileName)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="size-3.5 text-rose-600" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
