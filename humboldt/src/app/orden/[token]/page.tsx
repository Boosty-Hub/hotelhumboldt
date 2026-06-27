import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { BeoDownloadButton } from "./download-button";
import { BEO_DEPARTMENT_HEADER } from "@/app/(app)/beo/constants";
import type {
  BeoDepartmentReq,
  BeoMenuSection,
  BeoScheduleItem,
} from "@/app/(app)/beo/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const beo = await prisma.beo.findUnique({ where: { publicToken: token }, select: { number: true } });
  return { title: beo ? `BEO ${beo.number} — Hotel Humboldt` : "BEO" };
}

export default async function PublicBeoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const beo = await prisma.beo.findUnique({ where: { publicToken: token } });
  if (!beo) notFound();

  const schedule = (beo.schedule as BeoScheduleItem[] | null) ?? [];
  const menu = (beo.menu as BeoMenuSection[] | null) ?? [];
  const departments = (beo.departments as BeoDepartmentReq[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-zinc-900 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-xs text-zinc-500">BEO #{beo.number} · Hotel Humboldt</p>
        <BeoDownloadButton token={token} />
      </div>

      {/* Cabecera */}
      <div className="border border-zinc-300">
        <div className="border-b border-zinc-300 bg-amber-50 px-3 py-1.5 text-center text-sm font-bold">
          BEO {beo.number}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <table className="w-full text-xs">
            <tbody>
              <Row k="Evento" v={beo.eventName} />
              <Row k="Cliente" v={beo.clientName} />
              <Row k="Espacio" v={beo.spaceName} />
              <Row
                k="Fecha"
                v={beo.eventDate ? format(beo.eventDate, "EEEE, d 'de' MMMM yyyy", { locale: es }) : "—"}
              />
              <Row k="Hora" v={beo.startTime} />
              <Row k="PAX" v={beo.pax != null ? `${beo.pax} PAX` : "—"} />
              <Row k="Responsable" v={beo.responsable} />
            </tbody>
          </table>
          <div className="flex items-center justify-center p-4">
            <Logo className="h-20 w-auto" />
          </div>
        </div>
      </div>

      {schedule.length > 0 && (
        <Section title="Programa">
          <table className="w-full border-collapse border border-zinc-300 text-xs">
            <thead>
              <tr className="bg-zinc-100">
                <th className="border border-zinc-300 px-2 py-1 text-left">Hora</th>
                <th className="border border-zinc-300 px-2 py-1 text-left">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((r, i) => (
                <tr key={i}>
                  <td className="border border-zinc-300 px-2 py-1">{r.time}</td>
                  <td className="border border-zinc-300 px-2 py-1">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {menu.length > 0 && (
        <Section title="Requerimiento de Alimentos y Bebidas">
          <div className="space-y-2">
            {menu.map((m, i) => (
              <div key={i}>
                <p className="text-xs font-semibold">{m.section}</p>
                <ul className="list-disc pl-5 text-xs">
                  {m.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {departments.length > 0 && (
        <Section title="Requerimientos por departamento">
          <div className="space-y-1.5">
            {departments.map((d) => {
              const participates = Boolean(d.instructions?.trim());
              return (
                <div
                  key={d.key}
                  className="break-inside-avoid overflow-hidden rounded border border-zinc-300"
                >
                  <div
                    className={cn(
                      "px-2 py-1 text-sm font-bold uppercase",
                      BEO_DEPARTMENT_HEADER
                    )}
                  >
                    {d.label}
                  </div>
                  {participates ? (
                    <p className="whitespace-pre-wrap px-2 py-1.5 text-xs">{d.instructions}</p>
                  ) : (
                    <p className="px-2 py-1.5 text-xs italic text-zinc-400">
                      Sin requerimientos para este evento.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {beo.generalNotes && (
        <Section title="Notas">
          <p className="whitespace-pre-wrap text-xs">{beo.generalNotes}</p>
        </Section>
      )}

      <p className="mt-6 text-center text-[10px] text-zinc-400 print:mt-4">
        Documento generado por el Sistema Comercial · Hotel Humboldt
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <tr>
      <td className="w-28 border border-zinc-300 bg-zinc-50 px-2 py-1 font-semibold">{k}</td>
      <td className="border border-zinc-300 px-2 py-1">{v ?? "—"}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 break-inside-avoid">
      <h2 className="mb-1 bg-sky-900 px-2 py-1 text-xs font-bold uppercase text-white">{title}</h2>
      {children}
    </div>
  );
}
