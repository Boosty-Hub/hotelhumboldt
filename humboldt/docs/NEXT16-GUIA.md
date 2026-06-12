# Next.js 16.2.9 — Guía obligatoria para este proyecto

Este proyecto usa **Next.js 16** (App Router). Patrones obligatorios — el código de v14/15 NO compila o se comporta mal:

## APIs request-time son Promises
```tsx
// Página dinámica (Server Component)
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
}

// Client component: use(params)
'use client'
import { use } from 'react'
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
}

// Route handler
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}

// cookies()/headers() son async
const store = await cookies();
```

## Revalidación
```tsx
// revalidatePath sigue igual:
revalidatePath('/pipeline')
// revalidateTag requiere 2º argumento:
revalidateTag('posts', 'max')
// Tras una mutación en server action, updateTag('x') invalida inmediato
```

## Convenciones
- `middleware.ts` NO existe → es `src/proxy.ts` con `export function proxy(request: NextRequest)` (ya creado — no tocar).
- Parallel routes requieren `default.tsx`.
- Turbopack es el bundler por defecto (sin flags).
- NO usar: `images.domains` (usar remotePatterns), `next lint`, `@next/font`.

## Convenciones de ESTE proyecto
- Prisma client: `import { prisma } from "@/lib/prisma"` (singleton).
- Auth: `import { auth, canViewCosts, canManageSettings } from "@/lib/auth"` — `const session = await auth()` en Server Components; `session.user.role` es `ADMIN | GERENTE | EJECUTIVO`.
- Constantes de dominio (etapas, estados, secciones, unidades, labels y colores): `@/lib/constants` — NUNCA escribir strings mágicos de estados; usar las constantes.
- Dinero: `@/lib/money` — `round2()`, `fmtUsd()`, `fmtBs()`, `fmtPct()`. SIEMPRE redondear con round2 y formatear con fmtUsd. Locale es-VE.
- Cálculo de cotizaciones: `@/lib/quote-calc` — `calcQuoteTotals(lines, params)`. NO reimplementar la lógica de totales.
- Parámetros comerciales: `@/lib/settings` — `getCommercialParams()`.
- Tasa BCV: `@/lib/bcv` — `getCurrentRate()`, `saveManualRate()`.
- UI: shadcn/ui en `@/components/ui/*` (ya instalados: button, card, dialog, dropdown-menu, input, label, select, table, tabs, badge, avatar, separator, sheet, popover, calendar, command, form, textarea, sonner, tooltip, skeleton, scroll-area, switch, checkbox, alert, alert-dialog, progress, input-group). Toasts: `import { toast } from "sonner"`.
- Iconos: lucide-react. Fechas: date-fns con locale es. IDs públicos: nanoid.
- Server Actions (`"use server"`) para mutaciones + `revalidatePath`. Validación con zod.
- Idioma de TODA la UI: español (Venezuela).
- El layout autenticado vive en `src/app/(app)/layout.tsx` — las páginas de módulos van DENTRO de `src/app/(app)/<modulo>/`.
- TODO el código de páginas: Server Components por defecto; client components solo donde hay interactividad.
- La base de datos es SQLite vía Prisma — los "enums" son String; validar contra las constantes.
