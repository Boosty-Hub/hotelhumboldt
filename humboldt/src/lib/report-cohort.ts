// Lógica pura de cohortes de presupuestos (réplica del Excel "Resumen").
// Compartida entre la página /reportes y su export CSV para no divergir.

import { differenceInCalendarDays, format, isSameMonth, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { round2 } from "./money";

export const WON_QUOTE_STATUSES = ["APROBADA", "CONTRATADA"];

/** Campos mínimos de una cotización necesarios para la cohorte. */
export interface QuoteLite {
  status: string;
  issueDate: Date;
  totalUsd: number;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  agreementDate: Date | null;
}

export interface MonthlyRow {
  key: string;
  label: string;
  realizadosCount: number;
  realizadosUsd: number;
  ganadosCount: number;
  ganadosUsd: number;
  arrastreCount: number;
  arrastreUsd: number;
  rechazadosCount: number;
  rechazadosUsd: number;
  sinRespuestaCount: number;
  sinRespuestaUsd: number;
  conversionPct: number | null;
}

export interface ReportTotals {
  realizadosCount: number;
  realizadosUsd: number;
  ganadosCount: number;
  ganadosUsd: number;
  arrastreCount: number;
  arrastreUsd: number;
  rechazadosCount: number;
  rechazadosUsd: number;
  sinRespuestaCount: number;
  sinRespuestaUsd: number;
  totalWon: number;
  totalClosed: number;
  totalConversion: number | null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fecha en que una cotización se considera "ganada". */
function wonDate(q: QuoteLite): Date {
  return q.approvedAt ?? q.agreementDate ?? q.updatedAt;
}

export function buildMonthlyRows(quotes: QuoteLite[], months: Date[], now: Date): MonthlyRow[] {
  const sum = (list: { totalUsd: number }[]) =>
    round2(list.reduce((acc, q) => acc + q.totalUsd, 0));

  return months.map((m) => {
    const realizados = quotes.filter((q) => isSameMonth(q.issueDate, m));
    const wonInMonth = quotes.filter(
      (q) => WON_QUOTE_STATUSES.includes(q.status) && isSameMonth(wonDate(q), m)
    );
    const ganados = wonInMonth.filter((q) => isSameMonth(q.createdAt, m));
    const arrastre = wonInMonth.filter(
      (q) => !isSameMonth(q.createdAt, m) && q.createdAt < startOfMonth(m)
    );
    const rechazados = quotes.filter(
      (q) => q.status === "RECHAZADA" && isSameMonth(q.updatedAt, m)
    );
    const sinRespuesta = quotes.filter(
      (q) =>
        q.status === "ENVIADA" &&
        isSameMonth(q.issueDate, m) &&
        differenceInCalendarDays(now, q.updatedAt) > 30
    );

    const ganadosTotal = wonInMonth.length;
    const cerradas = ganadosTotal + rechazados.length;
    const conversionPct = cerradas > 0 ? round2((ganadosTotal / cerradas) * 100) : null;

    return {
      key: format(m, "yyyy-MM"),
      label: capitalize(format(m, "MMMM yyyy", { locale: es })),
      realizadosCount: realizados.length,
      realizadosUsd: sum(realizados),
      ganadosCount: ganados.length,
      ganadosUsd: sum(ganados),
      arrastreCount: arrastre.length,
      arrastreUsd: sum(arrastre),
      rechazadosCount: rechazados.length,
      rechazadosUsd: sum(rechazados),
      sinRespuestaCount: sinRespuesta.length,
      sinRespuestaUsd: sum(sinRespuesta),
      conversionPct,
    };
  });
}

export function buildTotals(rows: MonthlyRow[]): ReportTotals {
  const t = rows.reduce(
    (acc, r) => ({
      realizadosCount: acc.realizadosCount + r.realizadosCount,
      realizadosUsd: round2(acc.realizadosUsd + r.realizadosUsd),
      ganadosCount: acc.ganadosCount + r.ganadosCount,
      ganadosUsd: round2(acc.ganadosUsd + r.ganadosUsd),
      arrastreCount: acc.arrastreCount + r.arrastreCount,
      arrastreUsd: round2(acc.arrastreUsd + r.arrastreUsd),
      rechazadosCount: acc.rechazadosCount + r.rechazadosCount,
      rechazadosUsd: round2(acc.rechazadosUsd + r.rechazadosUsd),
      sinRespuestaCount: acc.sinRespuestaCount + r.sinRespuestaCount,
      sinRespuestaUsd: round2(acc.sinRespuestaUsd + r.sinRespuestaUsd),
    }),
    {
      realizadosCount: 0,
      realizadosUsd: 0,
      ganadosCount: 0,
      ganadosUsd: 0,
      arrastreCount: 0,
      arrastreUsd: 0,
      rechazadosCount: 0,
      rechazadosUsd: 0,
      sinRespuestaCount: 0,
      sinRespuestaUsd: 0,
    }
  );
  const totalWon = t.ganadosCount + t.arrastreCount;
  const totalClosed = totalWon + t.rechazadosCount;
  const totalConversion = totalClosed > 0 ? round2((totalWon / totalClosed) * 100) : null;
  return { ...t, totalWon, totalClosed, totalConversion };
}
