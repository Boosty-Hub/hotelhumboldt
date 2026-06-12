import { Landmark, Percent } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ParamRow } from "../components/param-row";
import { PARAM_NOTES, PARAM_ORDER, suffixFor } from "../config-meta";

export const metadata = { title: "Parámetros comerciales" };

export default async function ParametrosPage() {
  const settings = await prisma.setting.findMany();

  const numericSettings = settings
    .filter((s) => s.type === "number" && (s.category === "impuestos" || s.category === "comercial"))
    .sort((a, b) => {
      const ia = PARAM_ORDER.indexOf(a.key);
      const ib = PARAM_ORDER.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  const taxSettings = numericSettings.filter((s) => s.category === "impuestos");
  const commercialSettings = numericSettings.filter((s) => s.category === "comercial");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Percent className="size-4 text-sky-950" />
            <CardTitle>Impuestos y cargos</CardTitle>
          </div>
          <CardDescription>
            Cada cargo puede habilitarse o deshabilitarse; los cambios aplican a las
            cotizaciones nuevas (las existentes conservan su configuración).
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {taxSettings.map((s) => (
            <ParamRow
              key={s.key}
              settingKey={s.key}
              label={s.label ?? s.key}
              value={s.value}
              enabled={s.enabled}
              note={PARAM_NOTES[s.key]}
              suffix={suffixFor(s.key)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-sky-950" />
            <CardTitle>Política comercial</CardTitle>
          </div>
          <CardDescription>
            Garantía, vigencia de cotizaciones y parámetros internos de precios.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {commercialSettings.map((s) => (
            <ParamRow
              key={s.key}
              settingKey={s.key}
              label={s.label ?? s.key}
              value={s.value}
              enabled={s.enabled}
              note={PARAM_NOTES[s.key]}
              suffix={suffixFor(s.key)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
