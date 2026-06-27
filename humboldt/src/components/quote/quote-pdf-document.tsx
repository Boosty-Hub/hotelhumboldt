// Render PDF NATIVO del documento de cotización (@react-pdf/renderer).
// Texto seleccionable y vectorial. Refleja el mismo contenido que QuoteDocument
// (la vista HTML). Se renderiza en el servidor desde la ruta /pdf.

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { fmtUsd, fmtPct, fmtNum } from "@/lib/money";
import { SECTIONS, SECTION_LABELS, type Section } from "@/lib/constants";
import { quoteBaseNumber } from "@/components/quote/quote-utils";
import type { QuoteDocumentProps } from "@/components/quote/quote-document";

const C = {
  sky950: "#082f49",
  sky900: "#0c4a6e",
  sky50: "#f0f9ff",
  zinc900: "#18181b",
  zinc600: "#52525b",
  zinc500: "#71717a",
  zinc400: "#a1a1aa",
  zinc200: "#e4e4e7",
  zinc100: "#f4f4f5",
  emerald: "#047857",
  amber: "#b45309",
  white: "#ffffff",
};

const UNIT_SHORT: Record<string, string> = {
  UND: "und",
  PAX: "p/p",
  BOTELLA: "bot.",
  DIA: "día",
  EVENTO: "evento",
  VEHICULO: "vehículo",
  KG: "kg",
  CAJA: "caja",
  HORA: "hora",
};

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingVertical: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.zinc900,
    lineHeight: 1.4,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: C.sky950,
    paddingBottom: 12,
  },
  hotelName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.sky950 },
  small: { fontSize: 8, color: C.zinc500 },
  headRight: { textAlign: "right" },
  eyebrow: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.zinc400, letterSpacing: 1 },
  quoteNo: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.sky950 },
  // Cliente / evento
  twoCol: { flexDirection: "row", gap: 12, marginTop: 14 },
  box: { flex: 1, borderWidth: 1, borderColor: C.zinc200, borderRadius: 5, padding: 10 },
  boxTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.zinc400, letterSpacing: 1 },
  strong: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 3 },
  message: { marginTop: 14, fontSize: 9.5, color: C.zinc600 },
  // Secciones
  section: { marginTop: 16 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.zinc200,
    paddingBottom: 4,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.sky950, letterSpacing: 0.5 },
  sectionSub: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.zinc500 },
  dayLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.zinc400, marginTop: 5, marginBottom: 2, letterSpacing: 0.5 },
  // Tabla
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.zinc200, paddingBottom: 3 },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.zinc400, letterSpacing: 0.5 },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.zinc100 },
  colDesc: { flex: 1, paddingRight: 6 },
  colQty: { width: 48, textAlign: "right", paddingRight: 6 },
  colUnit: { width: 46, paddingRight: 6 },
  colPrice: { width: 64, textAlign: "right", paddingRight: 6 },
  colSub: { width: 66, textAlign: "right" },
  comment: { fontSize: 8, color: C.zinc500, marginTop: 1 },
  optional: { color: C.zinc400, fontFamily: "Helvetica-Oblique" },
  // Totales
  totalsWrap: { marginTop: 18, alignItems: "flex-end" },
  totals: { width: 250 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  tLabel: { color: C.zinc500 },
  tValue: { fontFamily: "Helvetica-Bold" },
  subtotalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.sky50,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 5,
  },
  subtotalText: { fontFamily: "Helvetica-Bold", color: C.sky950 },
  totalUsdBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.sky900,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 5,
  },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.sky950,
    paddingHorizontal: 6,
    paddingVertical: 6,
    marginTop: 5,
  },
  barWhiteBold: { color: C.white, fontFamily: "Helvetica-Bold" },
  barWhiteBig: { color: C.white, fontFamily: "Helvetica-Bold", fontSize: 12 },
  note: { fontSize: 8, color: C.zinc400, textAlign: "right", marginTop: 3 },
  // Legales
  legal: { marginTop: 18 },
  legalTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.zinc400, letterSpacing: 1 },
  legalItem: { flexDirection: "row", marginTop: 3 },
  legalNum: { width: 14, fontSize: 8, color: C.zinc600 },
  legalText: { flex: 1, fontSize: 8, color: C.zinc600 },
  // Footer
  footer: { marginTop: 24, borderTopWidth: 1, borderTopColor: C.zinc200, paddingTop: 12 },
  disclaimer: { marginTop: 12, fontSize: 7.5, color: C.zinc400, textAlign: "center" },
});

function fdate(iso: string | null): string | null {
  if (!iso) return null;
  return format(new Date(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tRow}>
      <Text style={s.tLabel}>{label}</Text>
      <Text style={s.tValue}>{value}</Text>
    </View>
  );
}

export function QuotePdfDocument(props: QuoteDocumentProps) {
  const { hotel, totals, params } = props;
  const multiDay = props.lines.some((l) => (l.dayNumber ?? 1) > 1);

  const sectionsWithLines = SECTIONS.filter((sec) =>
    props.lines.some((l) => l.section === sec)
  );

  const sectionSubtotal: Record<Section, number> = {
    MISCELANEOS: totals.subtotalMisc,
    TRASLADOS: totals.subtotalTransfers,
    ALIMENTOS_BEBIDAS: totals.subtotalFood,
    ESPACIOS: totals.subtotalSpaces,
  };

  const legalItems = (props.legalConditions ?? "")
    .split("\n")
    .map((x) => x.replace(/^\s*\d+[.)-]\s*/, "").trim())
    .filter(Boolean);

  const hotelContact = [hotel.phone, hotel.email].filter(Boolean).join("  ·  ");

  return (
    <Document
      title={`Cotización ${quoteBaseNumber(props.number)}`}
      author={hotel.name}
      creator={hotel.name}
    >
      <Page size="A4" style={s.page}>
        {/* Encabezado */}
        <View style={s.header}>
          <View>
            <Text style={s.hotelName}>{hotel.name}</Text>
            {hotel.rif ? <Text style={s.small}>RIF {hotel.rif}</Text> : null}
            {hotel.address ? <Text style={[s.small, { marginTop: 2 }]}>{hotel.address}</Text> : null}
            {hotelContact ? <Text style={s.small}>{hotelContact}</Text> : null}
          </View>
          <View style={s.headRight}>
            <Text style={s.eyebrow}>PRESUPUESTO</Text>
            <Text style={s.quoteNo}>{quoteBaseNumber(props.number)}</Text>
            {props.version > 1 ? (
              <Text style={[s.small, { fontFamily: "Helvetica-Bold" }]}>Versión {props.version}</Text>
            ) : null}
            <Text style={[s.small, { marginTop: 2 }]}>Emitido: {fdate(props.issueDate)}</Text>
            {props.validUntil ? (
              <Text style={s.small}>Válido hasta: {fdate(props.validUntil)}</Text>
            ) : null}
          </View>
        </View>

        {/* Cliente / Evento */}
        <View style={s.twoCol}>
          <View style={s.box}>
            <Text style={s.boxTitle}>CLIENTE</Text>
            <Text style={s.strong}>{props.clientName}</Text>
            {props.clientBrand ? <Text style={s.small}>{props.clientBrand}</Text> : null}
            {props.clientRif ? <Text style={s.small}>RIF {props.clientRif}</Text> : null}
            {props.contactName ? (
              <Text style={[s.small, { marginTop: 2 }]}>Atención: {props.contactName}</Text>
            ) : null}
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>EVENTO</Text>
            <Text style={s.strong}>{props.eventName ?? "—"}</Text>
            {props.eventDateLabel ? (
              <Text style={s.small}>
                {props.eventDateLabel}
                {props.datesTentative ? "  (fechas por confirmar)" : ""}
              </Text>
            ) : null}
            {props.eventTimeLabel ? <Text style={s.small}>{props.eventTimeLabel}</Text> : null}
            {props.eventPax != null ? (
              <Text style={s.small}>
                {props.eventPax} invitados{props.paxApproximate ? " (aprox.)" : ""}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Mensaje de cortesía */}
        {props.clientMessage ? <Text style={s.message}>{props.clientMessage}</Text> : null}

        {/* Secciones */}
        {sectionsWithLines.map((section) => {
          const sectionLines = props.lines
            .filter((l) => l.section === section)
            .sort((a, b) => (a.dayNumber ?? 0) - (b.dayNumber ?? 0));
          const days = multiDay
            ? [...new Set(sectionLines.map((l) => l.dayNumber ?? 0))].sort((a, b) => a - b)
            : [0];

          return (
            <View key={section} style={s.section} wrap={false}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>
                  {SECTION_LABELS[section]}
                  {section === "TRASLADOS" ? "   (Exento de IVA)" : ""}
                </Text>
                <Text style={s.sectionSub}>{fmtUsd(sectionSubtotal[section])}</Text>
              </View>

              {days.map((day) => {
                const dayLines = multiDay
                  ? sectionLines.filter((l) => (l.dayNumber ?? 0) === day)
                  : sectionLines;
                if (dayLines.length === 0) return null;
                return (
                  <View key={day}>
                    {multiDay && day > 0 ? <Text style={s.dayLabel}>DÍA {day}</Text> : null}
                    <View style={s.thead}>
                      <Text style={[s.th, s.colDesc]}>Descripción</Text>
                      <Text style={[s.th, s.colQty]}>Cant.</Text>
                      <Text style={[s.th, s.colUnit]}>Unidad</Text>
                      <Text style={[s.th, s.colPrice]}>Precio</Text>
                      <Text style={[s.th, s.colSub]}>Subtotal</Text>
                    </View>
                    {dayLines.map((l, i) => (
                      <View key={i} style={s.row}>
                        <View style={s.colDesc}>
                          <Text style={l.isOptional ? s.optional : {}}>
                            {l.description}
                            {l.isOptional ? "  (referencial)" : ""}
                          </Text>
                          {l.comment ? <Text style={s.comment}>{l.comment}</Text> : null}
                        </View>
                        <Text style={[s.colQty, l.isOptional ? s.optional : {}]}>
                          {fmtNum(l.quantity, Number.isInteger(l.quantity) ? 0 : 2)}
                        </Text>
                        <Text style={[s.colUnit, s.small, l.isOptional ? s.optional : {}]}>
                          {UNIT_SHORT[l.unit] ?? l.unit.toLowerCase()}
                        </Text>
                        <Text style={[s.colPrice, l.isOptional ? s.optional : {}]}>
                          {fmtUsd(l.unitPrice)}
                        </Text>
                        <Text
                          style={[
                            s.colSub,
                            { fontFamily: "Helvetica-Bold" },
                            l.isOptional ? s.optional : {},
                          ]}
                        >
                          {l.isOptional ? "—" : fmtUsd(l.subtotal)}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Totales */}
        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totals}>
            {totals.subtotalMisc > 0 ? (
              <TotalRow label="Total Misceláneos" value={fmtUsd(totals.subtotalMisc)} />
            ) : null}
            {totals.subtotalFood > 0 ? (
              <TotalRow label="Total AyB" value={fmtUsd(totals.subtotalFood)} />
            ) : null}
            {totals.subtotalSpaces > 0 ? (
              <TotalRow label="Total Salones" value={fmtUsd(totals.subtotalSpaces)} />
            ) : null}

            {totals.discountAmount > 0 ? (
              <View style={[s.tRow, { marginTop: 3 }]}>
                <Text style={{ color: C.emerald, fontFamily: "Helvetica-Bold" }}>
                  Descuento de gerencia ({fmtPct(totals.discountPct)})
                </Text>
                <Text style={{ color: C.emerald, fontFamily: "Helvetica-Bold" }}>
                  −{fmtUsd(totals.discountAmount)}
                </Text>
              </View>
            ) : null}

            {totals.taxableBase > 0 ? (
              <View style={s.subtotalBar}>
                <Text style={s.subtotalText}>Sub Total USD</Text>
                <Text style={s.subtotalText}>{fmtUsd(totals.taxableBase)}</Text>
              </View>
            ) : null}

            <View style={{ marginTop: 4 }}>
              {totals.subtotalTransfers > 0 ? (
                <TotalRow label="Traslados — Exento de IVA" value={fmtUsd(totals.subtotalTransfers)} />
              ) : null}
              {params.serviceEnabled && totals.serviceAmount > 0 ? (
                <TotalRow
                  label={`Total ${fmtPct(params.servicePct)} de servicio`}
                  value={fmtUsd(totals.serviceAmount)}
                />
              ) : null}
              {params.taxEnabled ? (
                <TotalRow label={`${fmtPct(params.taxPct)} IVA`} value={fmtUsd(totals.taxAmount)} />
              ) : null}
            </View>

            {params.depositEnabled && totals.depositAmount > 0 ? (
              <>
                <View style={s.totalUsdBar}>
                  <Text style={s.barWhiteBold}>Total USD</Text>
                  <Text style={s.barWhiteBold}>{fmtUsd(totals.totalUsd)}</Text>
                </View>
                <View style={{ marginTop: 4 }}>
                  <TotalRow
                    label={`Garantía ${fmtPct(params.depositPct)}`}
                    value={fmtUsd(totals.depositAmount)}
                  />
                </View>
                <View style={s.totalBar}>
                  <Text style={s.barWhiteBig}>TOTAL</Text>
                  <Text style={s.barWhiteBig}>{fmtUsd(totals.totalWithDeposit)}</Text>
                </View>
                <Text style={s.note}>
                  La garantía es un depósito reembolsable que se devuelve al finalizar el evento sin
                  novedades.
                </Text>
              </>
            ) : (
              <View style={s.totalBar}>
                <Text style={s.barWhiteBig}>TOTAL</Text>
                <Text style={s.barWhiteBig}>{fmtUsd(totals.totalUsd)}</Text>
              </View>
            )}

            {params.igtfEnabled && totals.igtfAmount > 0 ? (
              <Text style={s.note}>
                Si paga en divisas aplica IGTF {fmtPct(params.igtfPct)}: +{fmtUsd(totals.igtfAmount)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Condiciones legales */}
        {legalItems.length > 0 ? (
          <View style={s.legal} wrap={false}>
            <Text style={s.legalTitle}>CONDICIONES IMPORTANTES</Text>
            {legalItems.map((item, i) => (
              <View key={i} style={s.legalItem}>
                <Text style={s.legalNum}>{i + 1}.</Text>
                <Text style={s.legalText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Firma */}
        <View style={s.footer} wrap={false}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{props.signerName}</Text>
          <Text style={s.small}>Ejecutivo comercial · {hotel.name}</Text>
          {props.signerEmail ? <Text style={s.small}>{props.signerEmail}</Text> : null}
          <Text style={s.disclaimer}>
            Precios expresados en dólares americanos (USD). La factura fiscal se emite en bolívares a
            la tasa oficial BCV del día de la operación.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
