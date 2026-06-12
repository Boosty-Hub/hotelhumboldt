"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, Link2 } from "lucide-react";

/** Copia al portapapeles el link público de aprobación /cotizacion/{token}. */
export function CopyLinkButton({
  publicToken,
  variant = "outline",
  size = "sm",
}: {
  publicToken: string;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default" | "icon";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/cotizacion/${publicToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link público copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  return (
    <Button variant={variant} size={size} onClick={copy} type="button">
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
      Copiar link público
    </Button>
  );
}
