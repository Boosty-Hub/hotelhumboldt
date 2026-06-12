import { Mountain, FileQuestion } from "lucide-react";

export default function CotizacionNoDisponible() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-900 px-6 text-center text-white">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
          <Mountain className="h-4 w-4" />
        </span>
        Hotel Humboldt
      </div>

      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
        <FileQuestion className="h-8 w-8 text-sky-200" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Cotización no disponible</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-sky-200">
          El enlace que abriste no es válido o el presupuesto ya no está publicado. Si
          crees que se trata de un error, contacta a tu ejecutivo comercial del Hotel
          Humboldt para recibir un enlace actualizado.
        </p>
      </div>

      <p className="text-xs text-sky-300/70">
        © {new Date().getFullYear()} Hotel Humboldt · Waraira Repano
      </p>
    </div>
  );
}
