"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addClientNoteAction } from "../../actions";
import { initials } from "../../_lib/shared";

export function NoteComposer({
  clientId,
  userName,
}: {
  clientId: string;
  userName: string;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      const res = await addClientNoteAction(clientId, { body: text });
      if (!res.ok) {
        toast.error(res.fieldErrors?.body ?? res.error);
        return;
      }
      setBody("");
      toast.success("Nota agregada");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-3">
      <Avatar className="mt-1 h-8 w-8 shrink-0">
        <AvatarFallback className="bg-sky-950 text-[10px] font-semibold text-white">
          {initials(userName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe una nota sobre este cliente… (acuerdos, preferencias, seguimiento)"
          rows={3}
          disabled={pending}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !body.trim()}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" data-icon="inline-start" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            Agregar nota
          </Button>
        </div>
      </div>
    </form>
  );
}
