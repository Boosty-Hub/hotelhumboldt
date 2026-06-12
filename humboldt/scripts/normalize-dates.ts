// Migración única: normaliza fechas de día completo a medianoche UTC.
import { PrismaClient } from "@prisma/client";
import { floorUtcDay } from "../src/lib/dates";
const p = new PrismaClient();
async function main() {
  let fixed = 0;
  const res = await p.spaceReservation.findMany();
  for (const r of res) {
    const norm = floorUtcDay(r.date);
    if (norm.getTime() !== r.date.getTime()) {
      await p.spaceReservation.update({ where: { id: r.id }, data: { date: norm } });
      fixed++;
    }
  }
  let evFixed = 0;
  const evs = await p.event.findMany();
  for (const e of evs) {
    const data: { startDate?: Date; endDate?: Date } = {};
    if (e.startDate) { const n = floorUtcDay(e.startDate); if (n.getTime() !== e.startDate.getTime()) data.startDate = n; }
    if (e.endDate) { const n = floorUtcDay(e.endDate); if (n.getTime() !== e.endDate.getTime()) data.endDate = n; }
    if (Object.keys(data).length) { await p.event.update({ where: { id: e.id }, data }); evFixed++; }
  }
  let opFixed = 0;
  const ops = await p.opportunity.findMany({ where: { expectedEventDate: { not: null } } });
  for (const o of ops) {
    const n = floorUtcDay(o.expectedEventDate!);
    if (n.getTime() !== o.expectedEventDate!.getTime()) { await p.opportunity.update({ where: { id: o.id }, data: { expectedEventDate: n } }); opFixed++; }
  }
  console.log(`Normalizadas: reservas=${fixed} eventos=${evFixed} oportunidades=${opFixed}`);
  // Verificar que ninguna reserva quede con hora != 00:00:00Z
  const bad = (await p.spaceReservation.findMany()).filter((r) => r.date.toISOString().slice(11) !== "00:00:00.000Z");
  console.log("Reservas con hora no-medianoche-UTC tras migración:", bad.length, bad.length === 0 ? "✅" : "❌");
}
main().finally(() => p.$disconnect());
