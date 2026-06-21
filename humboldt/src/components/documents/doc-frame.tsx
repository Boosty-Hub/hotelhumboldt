"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

const PRINT_CSS = `@media print {
  .doc-noprint { display: none !important; }
  .doc-canvas { padding: 0 !important; background: white !important; border: 0 !important; overflow: visible !important; }
  @page { margin: 12mm; }
  body { background: white !important; }
}`;

/** Marco con barra de acciones (no se imprime) + formulario lateral + lienzo del documento. */
export function DocFrame({
  title,
  form,
  children,
}: {
  title: string;
  form: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="doc-noprint sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-2.5">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/documentos" aria-label="Volver a documentos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm font-semibold">{title}</span>
        <Button size="sm" className="ml-auto" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Imprimir / PDF
        </Button>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[320px_1fr]">
        <aside className="doc-noprint space-y-3">{form}</aside>
        <div className="doc-canvas overflow-auto rounded-lg border bg-zinc-100 p-4">{children}</div>
      </div>
    </div>
  );
}
