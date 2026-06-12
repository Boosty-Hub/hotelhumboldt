"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { saveSettingAction } from "../actions";

interface ParamRowProps {
  settingKey: string;
  label: string;
  value: string;
  enabled: boolean;
  note?: string;
  suffix?: string; // "%" | "días"
}

/** Fila editable de un parámetro comercial: valor + switch de habilitado + guardar. */
export function ParamRow({ settingKey, label, value, enabled, note, suffix = "%" }: ParamRowProps) {
  const [draftValue, setDraftValue] = useState(value);
  const [draftEnabled, setDraftEnabled] = useState(enabled);
  const [pending, startTransition] = useTransition();

  const dirty =
    (draftValue !== value || draftEnabled !== enabled) && draftValue.trim() !== "";

  function handleSave() {
    startTransition(async () => {
      const res = await saveSettingAction({
        key: settingKey,
        value: draftValue,
        enabled: draftEnabled,
      });
      if (res.ok) toast.success(res.message ?? "Parámetro guardado.");
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1 sm:max-w-[55%]">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-medium ${draftEnabled ? "" : "text-muted-foreground"}`}>
            {label}
          </p>
          {!draftEnabled && (
            <Badge variant="outline" className="text-muted-foreground">
              Deshabilitado
            </Badge>
          )}
        </div>
        {note && <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <InputGroup className="w-28">
          <InputGroupInput
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={draftValue}
            disabled={!draftEnabled || pending}
            onChange={(e) => setDraftValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && dirty) handleSave();
            }}
            aria-label={label}
            className="text-right tabular-nums"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{suffix}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>

        <Switch
          checked={draftEnabled}
          disabled={pending}
          onCheckedChange={setDraftEnabled}
          aria-label={`Habilitar ${label}`}
        />

        <Button size="sm" disabled={!dirty || pending} onClick={handleSave} className="w-20">
          {pending ? <Loader2 className="animate-spin" /> : <Save data-icon="inline-start" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}
