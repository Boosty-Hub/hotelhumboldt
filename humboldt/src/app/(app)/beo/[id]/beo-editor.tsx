"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  History,
  Link2,
  Plus,
  Printer,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BEO_DEPARTMENT_HEADER,
  BEO_STATUS_COLORS,
  BEO_STATUS_LABELS,
  type BeoDepartmentReq,
  type BeoMenuSection,
  type BeoScheduleItem,
  type BeoStatus,
} from "../constants";
import { getBeoLog, setBeoStatus, updateBeo, type BeoLogEntry } from "../actions";

export interface BeoData {
  id: string;
  number: number;
  status: string;
  responsable: string;
  eventName: string;
  clientName: string;
  spaceName: string;
  eventDate: string; // yyyy-MM-dd
  startTime: string;
  pax: number | null;
  publicToken: string;
  schedule: BeoScheduleItem[];
  menu: BeoMenuSection[];
  departments: BeoDepartmentReq[];
  generalNotes: string;
}

type MenuEdit = { section: string; itemsText: string };

export function BeoEditor({ beo }: { beo: BeoData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [status, setStatus] = useState(beo.status);
  const [responsable, setResponsable] = useState(beo.responsable);
  const [eventName, setEventName] = useState(beo.eventName);
  const [clientName, setClientName] = useState(beo.clientName);
  const [spaceName, setSpaceName] = useState(beo.spaceName);
  const [eventDate, setEventDate] = useState(beo.eventDate);
  const [startTime, setStartTime] = useState(beo.startTime);
  const [pax, setPax] = useState(beo.pax != null ? String(beo.pax) : "");
  const [schedule, setSchedule] = useState<BeoScheduleItem[]>(beo.schedule);
  const [menu, setMenu] = useState<MenuEdit[]>(
    beo.menu.map((m) => ({ section: m.section, itemsText: (m.items ?? []).join("\n") }))
  );
  const [departments, setDepartments] = useState<BeoDepartmentReq[]>(beo.departments);
  const [generalNotes, setGeneralNotes] = useState(beo.generalNotes);

  const [logs, setLogs] = useState<BeoLogEntry[]>([]);
  useEffect(() => {
    getBeoLog(beo.id).then(setLogs).catch(() => {});
  }, [beo.id]);

  function save() {
    startTransition(async () => {
      const res = await updateBeo({
        id: beo.id,
        responsable: responsable || null,
        eventName: eventName || null,
        clientName: clientName || null,
        spaceName: spaceName || null,
        eventDate: eventDate || null,
        startTime: startTime || null,
        pax: pax.trim() ? Number(pax) : null,
        schedule,
        menu: menu.map((m) => ({
          section: m.section,
          items: m.itemsText.split("\n").map((s) => s.trim()).filter(Boolean),
        })),
        departments,
        generalNotes: generalNotes || null,
      });
      if (res.ok) {
        toast.success("BEO guardado.");
        getBeoLog(beo.id).then(setLogs).catch(() => {});
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function emit() {
    const next = status === "EMITIDO" ? "BORRADOR" : "EMITIDO";
    startTransition(async () => {
      const res = await setBeoStatus({ id: beo.id, status: next });
      if (res.ok) {
        setStatus(next);
        toast.success(next === "EMITIDO" ? "BEO emitido." : "BEO vuelto a borrador.");
        getBeoLog(beo.id).then(setLogs).catch(() => {});
      } else {
        toast.error(res.error);
      }
    });
  }

  function copyLink() {
    const url = `${window.location.origin}/orden/${beo.publicToken}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link público copiado. Compartilo por correo o WhatsApp."),
      () => toast.error("No se pudo copiar el link.")
    );
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/beo" aria-label="Volver a BEOs">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-bold tracking-tight">BEO #{beo.number}</h1>
              <Badge variant="outline" className={cn(BEO_STATUS_COLORS[status as BeoStatus])}>
                {BEO_STATUS_LABELS[status as BeoStatus] ?? status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{eventName || "Evento"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={copyLink}>
            <Link2 data-icon="inline-start" />
            Copiar link
          </Button>
          <Button asChild variant="outline">
            <Link href={`/orden/${beo.publicToken}`} target="_blank">
              <Printer data-icon="inline-start" />
              Ver / Imprimir PDF
            </Link>
          </Button>
          <Button variant="outline" onClick={emit} disabled={pending}>
            <Send data-icon="inline-start" />
            {status === "EMITIDO" ? "Volver a borrador" : "Emitir"}
          </Button>
          <Button onClick={save} disabled={pending} className="bg-sky-950 hover:bg-sky-900">
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {/* Cabecera del evento */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del evento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label="Evento" value={eventName} onChange={setEventName} />
          <Field label="Cliente" value={clientName} onChange={setClientName} />
          <Field label="Espacio / Salón" value={spaceName} onChange={setSpaceName} />
          <div className="space-y-1.5">
            <Label htmlFor="b-date">Fecha</Label>
            <Input id="b-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-time">Hora</Label>
            <Input id="b-time" value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="08:00 AM" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-pax">PAX</Label>
            <Input id="b-pax" type="number" value={pax} onChange={(e) => setPax(e.target.value)} />
          </div>
          <Field label="Responsable" value={responsable} onChange={setResponsable} />
        </CardContent>
      </Card>

      {/* Cronograma */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Programa / Cronograma</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSchedule((s) => [...s, { time: "", description: "" }])}
            >
              <Plus data-icon="inline-start" />
              Agregar línea
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {schedule.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin líneas. Agregá el run-of-show del evento.</p>
          )}
          {schedule.map((row, i) => (
            <div key={i} className="grid grid-cols-[90px_1fr_auto] items-start gap-2">
              <Input
                value={row.time}
                onChange={(e) => setSchedule((s) => s.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)))}
                placeholder="Hora"
              />
              <Input
                value={row.description}
                onChange={(e) =>
                  setSchedule((s) => s.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))
                }
                placeholder="Descripción"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSchedule((s) => s.filter((_, j) => j !== i))}
                aria-label="Quitar línea"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Menú / A&B */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Requerimiento de Alimentos y Bebidas</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMenu((m) => [...m, { section: "", itemsText: "" }])}
            >
              <Plus data-icon="inline-start" />
              Agregar sección
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {menu.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sin secciones. Se autocompletan desde la cotización; podés ajustarlas acá.
            </p>
          )}
          {menu.map((m, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border bg-muted/20 p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  value={m.section}
                  onChange={(e) => setMenu((arr) => arr.map((s, j) => (j === i ? { ...s, section: e.target.value } : s)))}
                  placeholder="Sección (ej. Estación Líquida, Pasapalos, Buffet)"
                  className="font-medium"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMenu((arr) => arr.filter((_, j) => j !== i))}
                  aria-label="Quitar sección"
                >
                  <Trash2 />
                </Button>
              </div>
              <Textarea
                value={m.itemsText}
                onChange={(e) => setMenu((arr) => arr.map((s, j) => (j === i ? { ...s, itemsText: e.target.value } : s)))}
                placeholder="Un ítem por línea…"
                className="min-h-20 text-xs"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Requerimientos por departamento */}
      <Card>
        <CardHeader>
          <CardTitle>Requerimientos por departamento</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cada departamento se ubica por su color. Con instrucciones → participa; vacío → sin
            participación.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {departments.map((d, i) => {
            const participates = d.instructions.trim().length > 0;
            return (
              <div key={d.key} className="overflow-hidden rounded-lg border">
                <div
                  className={cn(
                    "flex items-center justify-between px-3 py-2",
                    BEO_DEPARTMENT_HEADER
                  )}
                >
                  <span className="text-sm font-bold uppercase tracking-wide">{d.label}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-white/40 text-[10px]",
                      participates ? "bg-white/25 text-white" : "bg-black/10 text-white/80"
                    )}
                  >
                    {participates ? "Participa" : "Sin participación"}
                  </Badge>
                </div>
                <Textarea
                  value={d.instructions}
                  onChange={(e) =>
                    setDepartments((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x))
                    )
                  }
                  placeholder={`Instrucciones para ${d.label}… (vacío = no participa)`}
                  className="min-h-16 rounded-none border-0 text-xs focus-visible:ring-0"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Notas generales */}
      <Card>
        <CardHeader>
          <CardTitle>Notas generales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Observaciones generales del evento…"
            className="min-h-20 text-xs"
          />
        </CardContent>
      </Card>

      {/* Log de actividad */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <CardTitle>Log de actividad</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin movimientos.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {logs.map((l) => (
                <li key={l.id} className="relative">
                  <span className="absolute -left-[21px] mt-0.5 size-2.5 rounded-full bg-sky-500 ring-2 ring-background" />
                  <p className="text-xs font-medium">{l.action}</p>
                  {l.detail && <p className="text-xs text-muted-foreground">{l.detail}</p>}
                  <p className="text-[10px] text-muted-foreground">
                    {l.userName ?? "Sistema"} ·{" "}
                    {format(parseISO(l.createdAt), "dd/MM/yyyy, HH:mm", { locale: es })}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
