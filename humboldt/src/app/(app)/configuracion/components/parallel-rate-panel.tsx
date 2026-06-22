"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, PencilLine, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { fmtBs } from "@/lib/money";
import { setParallelRateAction } from "../actions";
import type { RateInfo } from "../types";

/** Tasa paralela: se ingresa manualmente y convive con la BCV (oficial). */
export function ParallelRatePanel({ rate }: { rate: RateInfo | null }) {
  const [value, setValue] = useState("");
  const [saving, startSave] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startSave(async () => {
      const res = await setParallelRateAction({ rate: value });
      if (res.ok) {
        toast.success(res.message ?? "Tasa paralela registrada.");
        setValue("");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Tasa paralela vigente</CardTitle>
          <CardDescription>
            Tasa de referencia que se ingresa a mano. Es opcional al cotizar y cobrar; la
            factura legal siempre usa la tasa BCV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rate ? (
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold tracking-tight tabular-nums">{fmtBs(rate.rate)}</p>
              <span className="text-sm text-muted-foreground">por USD</span>
              <Badge
                variant="outline"
                className="ml-2 border-violet-200 bg-violet-100 text-violet-800"
              >
                Paralela
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(rate.date, "d 'de' MMMM yyyy, h:mm a", { locale: es })}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <TrendingUp className="size-9 text-muted-foreground/60" />
              <p className="text-sm font-medium">Sin tasa paralela registrada</p>
              <p className="text-xs text-muted-foreground">
                Cargá una tasa para poder elegirla al cotizar o cobrar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar tasa paralela</CardTitle>
          <CardDescription>Se actualiza solo cuando vos la cargás.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="parallel-rate">Bolívares por USD</Label>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>Bs.</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="parallel-rate"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  placeholder="0,00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={saving}
                  required
                  className="text-right tabular-nums"
                />
              </InputGroup>
            </div>
            <Button type="submit" disabled={saving || !value} className="w-full">
              {saving ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <PencilLine data-icon="inline-start" />
              )}
              Guardar tasa paralela
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
