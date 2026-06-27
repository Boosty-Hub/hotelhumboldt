// Render PDF NATIVO del BEO (orden de evento) con @react-pdf/renderer.
// Texto seleccionable y vectorial. Refleja el mismo contenido que la vista
// pública /orden/[token]. Se renderiza en el servidor desde la ruta /pdf.

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  BeoDepartmentReq,
  BeoMenuSection,
  BeoScheduleItem,
} from "@/app/(app)/beo/constants";

export interface BeoPdfProps {
  hotelName: string;
  number: number;
  eventName: string | null;
  clientName: string | null;
  spaceName: string | null;
  /** Fecha ya formateada (ej. "Martes 30 de junio de 2026"). */
  eventDateLabel: string | null;
  startTime: string | null;
  pax: number | null;
  responsable: string | null;
  schedule: BeoScheduleItem[];
  menu: BeoMenuSection[];
  departments: BeoDepartmentReq[];
  generalNotes: string | null;
}

const C = {
  ink: "#18181b",
  sky900: "#0c4a6e",
  sky800: "#075985",
  amber50: "#fffbeb",
  zinc500: "#71717a",
  zinc400: "#a1a1aa",
  zinc300: "#d4d4d8",
  zinc100: "#f4f4f5",
  zinc50: "#fafafa",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingVertical: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.ink,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: C.sky900,
    paddingBottom: 12,
  },
  hotelName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.sky900 },
  small: { fontSize: 8, color: C.zinc500 },
  headRight: { textAlign: "right" },
  eyebrow: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.zinc400, letterSpacing: 1 },
  beoNo: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.sky900 },

  infoBox: { marginTop: 14, borderWidth: 1, borderColor: C.zinc300 },
  infoTitleBar: {
    backgroundColor: C.amber50,
    borderBottomWidth: 1,
    borderBottomColor: C.zinc300,
    paddingVertical: 4,
    alignItems: "center",
  },
  infoTitleText: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  infoRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.zinc300 },
  infoRowLast: { borderBottomWidth: 0 },
  infoKey: {
    width: 92,
    backgroundColor: C.zinc50,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 1,
    borderRightColor: C.zinc300,
  },
  infoVal: { flex: 1, paddingHorizontal: 6, paddingVertical: 4 },

  section: { marginTop: 16 },
  sectionTitle: {
    backgroundColor: C.sky900,
    color: C.white,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  table: { borderWidth: 1, borderColor: C.zinc300 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.zinc300 },
  trLast: { borderBottomWidth: 0 },
  trHead: { backgroundColor: C.zinc100 },
  thText: { fontFamily: "Helvetica-Bold" },
  tdHora: {
    width: 96,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRightWidth: 1,
    borderRightColor: C.zinc300,
  },
  tdDesc: { flex: 1, paddingHorizontal: 6, paddingVertical: 3 },

  menuSection: { marginBottom: 6 },
  menuName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  menuItem: { marginLeft: 8, marginBottom: 1 },

  deptBox: { borderWidth: 1, borderColor: C.zinc300, marginBottom: 6 },
  deptHead: { backgroundColor: C.sky800, paddingHorizontal: 6, paddingVertical: 3 },
  deptHeadText: {
    color: C.white,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  deptText: { paddingHorizontal: 6, paddingVertical: 4 },
  deptEmpty: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontFamily: "Helvetica-Oblique",
    color: C.zinc400,
  },

  notes: {},
  footer: { marginTop: 24, textAlign: "center", fontSize: 7.5, color: C.zinc400 },
});

function InfoRow({ k, v, last }: { k: string; v: string | null; last?: boolean }) {
  return (
    <View style={[s.infoRow, last ? s.infoRowLast : {}]}>
      <Text style={s.infoKey}>{k}</Text>
      <Text style={s.infoVal}>{v ?? "—"}</Text>
    </View>
  );
}

export function BeoPdfDocument(props: BeoPdfProps) {
  const schedule = props.schedule ?? [];
  const menu = props.menu ?? [];
  const departments = props.departments ?? [];

  return (
    <Document title={`BEO ${props.number}`} author={props.hotelName} creator={props.hotelName}>
      <Page size="A4" style={s.page}>
        {/* Encabezado */}
        <View style={s.header}>
          <View>
            <Text style={s.hotelName}>{props.hotelName}</Text>
            <Text style={s.small}>Orden de evento (BEO)</Text>
          </View>
          <View style={s.headRight}>
            <Text style={s.eyebrow}>BEO</Text>
            <Text style={s.beoNo}>#{props.number}</Text>
          </View>
        </View>

        {/* Cabecera del evento */}
        <View style={s.infoBox}>
          <View style={s.infoTitleBar}>
            <Text style={s.infoTitleText}>BEO {props.number}</Text>
          </View>
          <InfoRow k="Evento" v={props.eventName} />
          <InfoRow k="Cliente" v={props.clientName} />
          <InfoRow k="Espacio" v={props.spaceName} />
          <InfoRow k="Fecha" v={props.eventDateLabel} />
          <InfoRow k="Hora" v={props.startTime} />
          <InfoRow k="PAX" v={props.pax != null ? `${props.pax} PAX` : null} />
          <InfoRow k="Responsable" v={props.responsable} last />
        </View>

        {/* Programa */}
        {schedule.length > 0 ? (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Programa</Text>
            <View style={s.table}>
              <View style={[s.tr, s.trHead]}>
                <Text style={[s.tdHora, s.thText]}>Hora</Text>
                <Text style={[s.tdDesc, s.thText]}>Descripción</Text>
              </View>
              {schedule.map((r, i) => (
                <View key={i} style={[s.tr, i === schedule.length - 1 ? s.trLast : {}]}>
                  <Text style={s.tdHora}>{r.time}</Text>
                  <Text style={s.tdDesc}>{r.description}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Requerimiento de Alimentos y Bebidas */}
        {menu.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Requerimiento de Alimentos y Bebidas</Text>
            {menu.map((m, i) => (
              <View key={i} style={s.menuSection} wrap={false}>
                <Text style={s.menuName}>{m.section}</Text>
                {(m.items ?? []).map((it, j) => (
                  <Text key={j} style={s.menuItem}>
                    {`• ${it}`}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {/* Requerimientos por departamento */}
        {departments.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Requerimientos por departamento</Text>
            {departments.map((d) => {
              const participates = Boolean(d.instructions?.trim());
              return (
                <View key={d.key} style={s.deptBox} wrap={false}>
                  <View style={s.deptHead}>
                    <Text style={s.deptHeadText}>{d.label}</Text>
                  </View>
                  {participates ? (
                    <Text style={s.deptText}>{d.instructions}</Text>
                  ) : (
                    <Text style={s.deptEmpty}>Sin requerimientos para este evento.</Text>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Notas */}
        {props.generalNotes ? (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Notas</Text>
            <Text style={s.notes}>{props.generalNotes}</Text>
          </View>
        ) : null}

        <Text style={s.footer}>
          Documento generado por el Sistema Comercial · {props.hotelName}
        </Text>
      </Page>
    </Document>
  );
}
