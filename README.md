# Hotel Humboldt — Sistema Comercial

Sistema comercial para el **Hotel Humboldt** (Caracas, sobre el Waraira Repano): CRM de oportunidades, cotizador de eventos, calendario de salones, catálogo, proveedores, pagos y reportes. Sustituye el flujo actual basado en hojas de Excel.

La aplicación vive en [`humboldt/`](./humboldt).

## Funcionalidades

- **Pipeline de ventas** (kanban con arrastre): de Nuevo a Ganado/Perdido, con valor, probabilidad y responsable.
- **Cotizador de eventos**: 4 secciones (Misceláneos, Traslados, Alimentos y Bebidas, Espacios), precios especiales trazados (autor + motivo), costeo interno por rol, y **link público** para que el cliente apruebe o solicite cambios.
- **Calendario de salones**: timeline mensual con reservas Tentativas/Confirmadas y detección de conflictos.
- **Clientes (CRM)**, **catálogo de productos** (427 ítems reales), **proveedores**, **pagos y cobranza** (abonos multi-moneda, retenciones, conciliación) y **reportes/KPIs**.
- **Configuración** de parámetros comerciales activables: IVA, cargo de servicio, garantía, IGTF, vigencia, markup y margen mínimo.

## Reglas de negocio

- Cotización en **USD**; facturación en **Bs** a tasa **BCV** (automática con override).
- IVA 16% sobre Misceláneos + AyB + Espacios (traslados exentos); cargo de servicio 10% solo sobre AyB.
- Garantía 10% como **depósito reembolsable separado** (no se suma al total).
- Costos de proveedor y márgenes son **información interna** (visibles solo para Admin/Gerente).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Prisma · NextAuth v5. Base de datos: SQLite en desarrollo → PostgreSQL (Supabase) en producción.

## Puesta en marcha

```bash
cd humboldt
npm install
cp .env.example .env        # completa AUTH_SECRET
npx prisma migrate dev      # crea la base de datos
npx prisma db seed          # carga catálogo, salones, usuarios y datos reales
npm run dev                 # http://localhost:3000
```

Usuario de prueba tras el seed: `admin@hotelhumboldt.com` / `humboldt2026`.

## Documentación

- [`humboldt/docs/NEXT16-GUIA.md`](./humboldt/docs/NEXT16-GUIA.md) — convenciones del proyecto y particularidades de Next.js 16.
- [`_analysis/`](./_analysis) — análisis de los Excel originales del equipo comercial y modelo de datos unificado.
