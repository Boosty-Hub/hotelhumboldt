"use client";

// EL EDITOR de cotizaciones — client component principal.
// Los totales en vivo usan calcQuoteTotals (la misma función que el servidor
// usa al guardar; el cliente nunca es la fuente de verdad).

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/money";
import { calcQuoteTotals, isPriceOverride, type QuoteParams } from "@/lib/quote-calc";
import {
  SECTIONS,
  SECTION_LABELS,
  type DiscountType,
  type Section,
} from "@/lib/constants";
import {
  ChevronDown,
  Save,
  Eye,
  ArrowLeft,
  AlertTriangle,
  Lock,
  Loader2,
  CalendarPlus,
  Utensils,
  Bus,
  Sparkles,
  Building2,
  TrendingUp,
} from "lucide-react";
import { saveQuoteLines } from "@/app/(app)/cotizaciones/actions";
import { LineRow } from "./line-row";
import { ProductCombobox } from "./product-combobox";
import { DiscountDialog, type DiscountRequest } from "./discount-dialog";
import { TotalsSidebar } from "./totals-sidebar";
import { StatusActions } from "./status-actions";
import { CopyLinkButton } from "./copy-link-button";
import { QuoteStatusBadge } from "./quote-status-badge";
import {
  quoteBaseNumber,
  type CatalogProduct,
  type EditorLine,
  type SaveLineInput,
} from "./quote-utils";

const SECTION_ICONS: Record<Section, React.ComponentType<{ className?: string }>> = {
  MISCELANEOS: Sparkles,
  TRASLADOS: Bus,
  ALIMENTOS_BEBIDAS: Utensils,
  ESPACIOS: Building2,
};

export interface QuoteEditorProps {
  quoteId: string;
  number: string;
  version: number;
  status: string;
  publicToken: string;
  params: QuoteParams;
  clientName: string;
  eventName: string | null;
  eventPax: number | null;
  eventDays: number;
  initialLines: EditorLine[];
  catalog: CatalogProduct[];
  canViewCosts: boolean;
  currentUserName: string;
  bcvRate: number | null;
  newerVersion: { id: string; version: number } | null;
  minMarginPct: number;
}

let uidCounter = 0;
function newUid() {
  return `l-${Date.now()}-${uidCounter++}`;
}

export function QuoteEditor(props: QuoteEditorProps) {
  const router = useRouter();
  const [lines, setLines] = useState<EditorLine[]>(props.initialLines);
  const [dirty, setDirty] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [extraDays, setExtraDays] = useState(0);
  const [discountReq, setDiscountReq] = useState<DiscountRequest | null>(null);
  const [isSaving, startSaving] = useTransition();

  const readOnly = props.status !== "BORRADOR" && props.status !== "ENVIADA";

  // ── Aviso de cambios sin guardar al salir ──
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ── Mutaciones locales ──
  const patchLine = useCallback((uid: string, patch: Partial<EditorLine>) => {
    setLines((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
    setDirty(true);
  }, []);

  const deleteLine = useCallback((uid: string) => {
    setLines((ls) => ls.filter((l) => l.uid !== uid));
    setDirty(true);
  }, []);

  const ayBDays = useMemo(() => {
    const maxLineDay = Math.max(
      0,
      ...lines.filter((l) => l.section === "ALIMENTOS_BEBIDAS").map((l) => l.dayNumber ?? 1)
    );
    return Math.max(props.eventDays, maxLineDay, 1) + extraDays;
  }, [props.eventDays, lines, extraDays]);

  const multiDay = ayBDays > 1;

  function addProduct(section: Section, product: CatalogProduct, dayNumber: number | null) {
    const qty = product.unit === "PAX" && props.eventPax ? props.eventPax : product.minPax ?? 1;
    const line: EditorLine = {
      uid: newUid(),
      section,
      dayNumber,
      productId: product.id,
      description: product.name,
      comment: "",
      listPrice: product.listPrice,
      unitPrice: product.listPrice ?? 0,
      quantity: qty,
      unit: product.unit,
      isOptional: false,
      taxExempt: section === "TRASLADOS",
      sortOrder: lines.length,
      discountType: null,
      discountReason: null,
      discountAuthorName: null,
      unitCost: product.cost,
      costQuantity: null,
      supplierId: product.supplierId,
    };
    setLines((ls) => [...ls, line]);
    setDirty(true);
    if (product.listPrice == null) {
      toast.info(`"${product.name}" es de precio manual: indica el precio unitario.`);
    }
  }

  function addFreeLine(section: Section, dayNumber: number | null) {
    const line: EditorLine = {
      uid: newUid(),
      section,
      dayNumber,
      productId: null,
      description: "",
      comment: "",
      listPrice: null,
      unitPrice: 0,
      quantity: 1,
      unit: "UND",
      isOptional: false,
      taxExempt: section === "TRASLADOS",
      sortOrder: lines.length,
      discountType: null,
      discountReason: null,
      discountAuthorName: null,
      unitCost: null,
      costQuantity: null,
      supplierId: null,
    };
    setLines((ls) => [...ls, line]);
    setDirty(true);
  }

  // ── REGLA DE ORO: precio ≠ lista exige motivo trazado ──
  function commitPrice(uid: string, newPrice: number) {
    const line = lines.find((l) => l.uid === uid);
    if (!line) return;
    if (line.listPrice != null && isPriceOverride(newPrice, line.listPrice)) {
      // Mismo precio que ya estaba autorizado → no reabrir el dialog
      if (newPrice === line.unitPrice && line.discountType) return;
      patchLine(uid, { unitPrice: newPrice });
      setDiscountReq({
        uid,
        description: line.description || "Línea sin descripción",
        listPrice: line.listPrice,
        newPrice,
        currentType: line.discountType,
        currentReason: line.discountReason,
      });
    } else {
      patchLine(uid, {
        unitPrice: newPrice,
        discountType: null,
        discountReason: null,
        discountAuthorName: null,
      });
    }
  }

  function editDiscount(uid: string) {
    const line = lines.find((l) => l.uid === uid);
    if (!line || line.listPrice == null) return;
    setDiscountReq({
      uid,
      description: line.description,
      listPrice: line.listPrice,
      newPrice: line.unitPrice,
      currentType: line.discountType,
      currentReason: line.discountReason,
    });
  }

  function confirmDiscount(uid: string, type: DiscountType, reason: string) {
    patchLine(uid, {
      discountType: type,
      discountReason: reason,
      discountAuthorName: props.currentUserName,
    });
    setDiscountReq(null);
  }

  function cancelDiscount(uid: string) {
    // Sin motivo no hay precio especial: vuelve al precio de lista
    const line = lines.find((l) => l.uid === uid);
    if (line && line.listPrice != null) {
      patchLine(uid, {
        unitPrice: line.listPrice,
        discountType: null,
        discountReason: null,
        discountAuthorName: null,
      });
      toast.info("Precio restaurado al de lista (el precio especial requiere motivo).");
    }
    setDiscountReq(null);
  }

  // ── Totales en vivo ──
  const totals = useMemo(
    () =>
      calcQuoteTotals(
        lines.map((l) => ({
          section: l.section,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          isOptional: l.isOptional,
          taxExempt: l.taxExempt,
          unitCost: l.unitCost,
          costQuantity: l.costQuantity,
        })),
        props.params
      ),
    [lines, props.params]
  );

  const sectionSubtotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of SECTIONS) map[s] = 0;
    for (const l of lines) {
      if (!l.isOptional) map[l.section] += l.unitPrice * l.quantity;
    }
    return map;
  }, [lines]);

  // ── Guardar ──
  const save = useCallback(() => {
    // Validación previa en cliente para feedback inmediato
    const missing = lines.find((l) => !l.description.trim());
    if (missing) {
      toast.error("Hay líneas sin descripción. Complétalas antes de guardar.");
      return;
    }
    const unauthorized = lines.find(
      (l) =>
        l.listPrice != null &&
        isPriceOverride(l.unitPrice, l.listPrice) &&
        (!l.discountType || !l.discountReason)
    );
    if (unauthorized) {
      toast.error(
        `"${unauthorized.description}" tiene precio distinto al de lista sin motivo registrado.`
      );
      editDiscount(unauthorized.uid);
      return;
    }

    const payload: SaveLineInput[] = lines.map((l, idx) => ({
      id: l.id,
      section: l.section,
      dayNumber: l.section === "ALIMENTOS_BEBIDAS" && multiDay ? l.dayNumber ?? 1 : l.dayNumber,
      productId: l.productId,
      description: l.description.trim(),
      comment: l.comment.trim() || null,
      listPrice: l.listPrice,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      unit: l.unit,
      isOptional: l.isOptional,
      taxExempt: l.taxExempt,
      sortOrder: idx,
      discountType: (l.discountType as DiscountType) ?? null,
      discountReason: l.discountReason,
      ...(props.canViewCosts
        ? {
            unitCost: l.unitCost,
            costQuantity: l.costQuantity,
            supplierId: l.supplierId,
          }
        : {}),
    }));

    startSaving(async () => {
      const res = await saveQuoteLines(props.quoteId, payload);
      if (res.ok) {
        setDirty(false);
        toast.success("Cotización guardada y recalculada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, props.quoteId, props.canViewCosts, multiDay, router]);

  // Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!readOnly && dirty && !isSaving) save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, readOnly, dirty, isSaving]);

  // ── Render de una sección ──
  function renderSection(section: Section) {
    const Icon = SECTION_ICONS[section];
    const sectionLines = lines.filter((l) => l.section === section);
    const isCollapsed = collapsed[section];
    const dayGrouped = section === "ALIMENTOS_BEBIDAS" && multiDay;
    // El selector de productos muestra solo los de esta sección (según la
    // categoría). Los productos sin sección caen en Misceláneos como catch-all.
    const sectionCatalog = props.catalog.filter(
      (p) => p.section === section || (p.section === null && section === "MISCELANEOS")
    );

    return (
      <div key={section} className="rounded-xl border bg-card shadow-xs">
        <button
          type="button"
          onClick={() => setCollapsed((c) => ({ ...c, [section]: !c[section] }))}
          className="flex w-full items-center gap-2.5 rounded-t-xl px-4 py-3 text-left transition-colors hover:bg-muted/50"
          aria-expanded={!isCollapsed}
        >
          <Icon className="h-4 w-4 text-sky-900" />
          <span className="font-semibold">{SECTION_LABELS[section]}</span>
          {section === "TRASLADOS" && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Exento de IVA
            </Badge>
          )}
          {section === "ALIMENTOS_BEBIDAS" && props.params.serviceEnabled && (
            <Badge variant="outline" className="text-muted-foreground">
              +{props.params.servicePct}% servicio
            </Badge>
          )}
          <span className="ml-auto text-sm font-semibold tabular-nums text-muted-foreground">
            {fmtUsd(sectionSubtotals[section])}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isCollapsed && "-rotate-90"
            )}
          />
        </button>

        {!isCollapsed && (
          <div className="space-y-2 border-t px-4 py-3">
            {dayGrouped ? (
              <>
                {Array.from({ length: ayBDays }, (_, i) => i + 1).map((day) => {
                  const dayLines = sectionLines.filter((l) => (l.dayNumber ?? 1) === day);
                  return (
                    <div key={day} className="space-y-2">
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Día {day}
                      </p>
                      {dayLines.map((l) => (
                        <LineRow
                          key={l.uid}
                          line={l}
                          canViewCosts={props.canViewCosts}
                          minMarginPct={props.minMarginPct}
                          readOnly={readOnly}
                          onPatch={patchLine}
                          onPriceCommit={commitPrice}
                          onEditDiscount={editDiscount}
                          onDelete={deleteLine}
                        />
                      ))}
                      {!readOnly && (
                        <ProductCombobox
                          catalog={sectionCatalog}
                          onSelect={(p) => addProduct(section, p, day)}
                          onFreeLine={() => addFreeLine(section, day)}
                        />
                      )}
                    </div>
                  );
                })}
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setExtraDays((d) => d + 1)}
                    className="text-muted-foreground"
                  >
                    <CalendarPlus className="h-3 w-3" />
                    Agregar día {ayBDays + 1}
                  </Button>
                )}
              </>
            ) : (
              <>
                {sectionLines.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    Sin líneas en esta sección.
                  </p>
                )}
                {sectionLines.map((l) => (
                  <LineRow
                    key={l.uid}
                    line={l}
                    canViewCosts={props.canViewCosts}
                    readOnly={readOnly}
                    onPatch={patchLine}
                    onPriceCommit={commitPrice}
                    onEditDiscount={editDiscount}
                    onDelete={deleteLine}
                  />
                ))}
                {!readOnly && (
                  <ProductCombobox
                    catalog={sectionCatalog}
                    onSelect={(p) => addProduct(section, p, null)}
                    onFreeLine={() => addFreeLine(section, null)}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* ── Encabezado ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href="/cotizaciones" aria-label="Volver a cotizaciones">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold tracking-tight">
                {quoteBaseNumber(props.number)}
              </h1>
              <Badge variant="outline">v{props.version}</Badge>
              <QuoteStatusBadge status={props.status} />
              {dirty && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                  Cambios sin guardar
                </Badge>
              )}
            </div>
            <p className="ml-8 text-sm text-muted-foreground">
              {props.clientName}
              {props.eventName ? ` · ${props.eventName}` : ""}
              {props.eventPax ? ` · ${props.eventPax} pax` : ""}
              {props.eventDays > 1 ? ` · ${props.eventDays} días` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CopyLinkButton publicToken={props.publicToken} />
            <Button variant="outline" asChild>
              <Link href={`/cotizaciones/${props.quoteId}`}>
                <Eye className="h-3.5 w-3.5" />
                Ver documento
              </Link>
            </Button>
            {props.canViewCosts && (
              <Button variant="outline" asChild>
                <Link href={`/cotizaciones/${props.quoteId}/costos`}>
                  <TrendingUp className="h-3.5 w-3.5" />
                  Análisis de costos
                </Link>
              </Button>
            )}
            <StatusActions
              quoteId={props.quoteId}
              status={props.status}
              hasUnsavedChanges={dirty}
            />
            {!readOnly && (
              <Button onClick={save} disabled={isSaving || !dirty} className="min-w-24">
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {isSaving ? "Guardando…" : "Guardar"}
              </Button>
            )}
          </div>
        </div>

        {/* ── Banners ── */}
        {props.newerVersion && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Existe una versión más reciente (v{props.newerVersion.version}) de esta cotización.
              Esta queda como histórico.
            </span>
            <Button variant="outline" size="sm" asChild className="ml-auto shrink-0">
              <Link href={`/cotizaciones/${props.newerVersion.id}/editar`}>
                Ir a la v{props.newerVersion.version}
              </Link>
            </Button>
          </div>
        )}
        {readOnly && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            Esta cotización ya no es editable por su estado. Para modificarla, crea una nueva
            versión desde &quot;Acciones&quot;.
          </div>
        )}

        {/* ── Layout 2 columnas ── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-4">{SECTIONS.map(renderSection)}</div>
          <div className="xl:sticky xl:top-0 xl:self-start">
            <TotalsSidebar
              totals={totals}
              params={props.params}
              canViewCosts={props.canViewCosts}
              bcvRate={props.bcvRate}
              minMarginPct={props.minMarginPct}
            />
          </div>
        </div>

        <DiscountDialog
          request={discountReq}
          onConfirm={confirmDiscount}
          onCancel={cancelDiscount}
        />
      </div>
    </TooltipProvider>
  );
}
