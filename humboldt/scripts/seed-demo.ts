// Demo + verificación: replica la cotización REAL de Alimentos Mary (Excel)
// y comprueba que el motor de cálculo reproduce los totales exactos.
// Además siembra eventos y reservas para que el calendario tenga vida.
// Ejecutar: npx tsx scripts/seed-demo.ts
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import { calcQuoteTotals, type CalcLine } from "../src/lib/quote-calc";
import { round2 } from "../src/lib/money";

const prisma = new PrismaClient();

// ── Totales del Excel real "Alimentos Mary - Diana Sánchez.xlsx" ─────
const EXCEL = {
  subtotalMisc: 4939.65,
  subtotalTransfers: 2000,
  subtotalFood: 12760,
  subtotalSpaces: 5000,
  taxableBase: 22699.65, // SubTotal USD (G98)
  serviceAmount: 1276, // 10% servicio solo AyB (G83)
  taxAmount: 3631.94, // 16% IVA (G101=3631.944 → redondeado)
  totalUsd: 29607.59, // Total USD (G102=29607.594 → redondeado)
  depositAmount: 2960.76, // Garantía 10% (G103)
};

async function main() {
  console.log("🧪 Verificación del motor de cálculo vs Excel real…\n");

  // Líneas que replican los subtotales por sección del Excel
  const lines: (CalcLine & {
    section: string;
    description: string;
    unit: string;
    comment?: string;
    listPrice?: number | null;
    sortOrder: number;
    dayNumber?: number | null;
  })[] = [
    // MISCELÁNEOS — 4.939,65
    { section: "MISCELANEOS", description: "Decoración y ambientación navideña", unitPrice: 2939.65, quantity: 1, unit: "EVENTO", sortOrder: 0 },
    { section: "MISCELANEOS", description: "Personal de evento", unitPrice: 1320, quantity: 1, unit: "EVENTO", sortOrder: 1 },
    { section: "MISCELANEOS", description: "DJ profesional (hasta 8 horas)", unitPrice: 680, quantity: 1, unit: "EVENTO", sortOrder: 2 },
    // TRASLADOS — 2.000 (exentos de IVA)
    { section: "TRASLADOS", description: "Traslado en Sistema Teleférico ida y vuelta (antes de las 6:00 pm)", unitPrice: 10, quantity: 200, unit: "PAX", taxExempt: true, sortOrder: 3 },
    // ALIMENTOS Y BEBIDAS — 12.760
    { section: "ALIMENTOS_BEBIDAS", description: "Menú navideño plateado", comment: "Pernil glaseado, ensalada de gallina, pan de jamón y dulce navideño", unitPrice: 28, listPrice: 28, quantity: 200, unit: "PAX", unitCost: 17.5, sortOrder: 4 },
    { section: "ALIMENTOS_BEBIDAS", description: "Pasapalos surtidos (10 por persona, aproximadamente)", unitPrice: 2.5, quantity: 2000, unit: "UND", unitCost: 1.75, sortOrder: 5 },
    { section: "ALIMENTOS_BEBIDAS", description: "Estación de café americano", unitPrice: 4, listPrice: 4, quantity: 200, unit: "PAX", unitCost: 2, sortOrder: 6 },
    { section: "ALIMENTOS_BEBIDAS", description: "Refrescos en lata", unitPrice: 4, listPrice: 4, quantity: 340, unit: "UND", unitCost: 2, sortOrder: 7 },
    // ESPACIOS — 5.000
    { section: "ESPACIOS", description: "Estar General (alquiler por día)", unitPrice: 3000, listPrice: 3000, quantity: 1, unit: "DIA", sortOrder: 8 },
    { section: "ESPACIOS", description: "Terraza Norte y Sur (alquiler por día)", unitPrice: 1000, listPrice: 1000, quantity: 1, unit: "DIA", sortOrder: 9 },
    { section: "ESPACIOS", description: "Discoteca La Boite (alquiler por día)", unitPrice: 1000, listPrice: 1000, quantity: 1, unit: "DIA", sortOrder: 10 },
  ];

  const totals = calcQuoteTotals(lines, {
    taxPct: 16,
    taxEnabled: true,
    servicePct: 10,
    serviceEnabled: true,
    depositPct: 10,
    depositEnabled: true,
    igtfPct: 3,
    igtfEnabled: true,
  });

  let ok = true;
  const checks: [string, number, number][] = [
    ["Subtotal Misceláneos", totals.subtotalMisc, EXCEL.subtotalMisc],
    ["Subtotal Traslados (exento)", totals.subtotalTransfers, EXCEL.subtotalTransfers],
    ["Subtotal AyB", totals.subtotalFood, EXCEL.subtotalFood],
    ["Subtotal Espacios", totals.subtotalSpaces, EXCEL.subtotalSpaces],
    ["Base imponible (SubTotal USD)", totals.taxableBase, EXCEL.taxableBase],
    ["Servicio 10% sobre AyB", totals.serviceAmount, EXCEL.serviceAmount],
    ["IVA 16%", totals.taxAmount, EXCEL.taxAmount],
    ["TOTAL USD", totals.totalUsd, EXCEL.totalUsd],
    ["Garantía 10% (depósito)", totals.depositAmount, EXCEL.depositAmount],
  ];
  for (const [label, got, expected] of checks) {
    const pass = round2(got) === round2(expected);
    if (!pass) ok = false;
    console.log(`${pass ? "✅" : "❌"} ${label}: app=${got} excel=${expected}`);
  }
  if (!ok) throw new Error("El motor de cálculo NO reproduce los totales del Excel");
  console.log("\n🎯 Motor de cálculo verificado contra el Excel real.\n");

  // ── Sembrar la cotización demo en la BD ────────────────────────────
  const existing = await prisma.quote.findFirst({ where: { number: { startsWith: "COT-2026-9" } } });
  if (existing) {
    console.log("ℹ Demo ya sembrada anteriormente — saltando.");
    return;
  }

  const client = await prisma.client.findFirst({ where: { legalName: { contains: "IANCARINA" } } });
  const kristian = await prisma.user.findFirst({ where: { email: "kjaen@hotelhumboldt.com" } });
  if (!client || !kristian) throw new Error("Falta cliente IANCARINA o usuario Kristian del seed base");

  const settings = await prisma.setting.findMany({
    where: { key: { in: ["quote_greeting", "quote_legal_conditions"] } },
  });
  const greeting = settings.find((s) => s.key === "quote_greeting")?.value ?? null;
  const legal = settings.find((s) => s.key === "quote_legal_conditions")?.value ?? null;

  const opp = await prisma.opportunity.create({
    data: {
      code: "OP-2026-9001",
      clientId: client.id,
      ownerId: kristian.id,
      title: "Fiesta de Navidad — Alimentos Mary",
      eventType: "Fiesta de Navidad",
      channel: "CRM",
      stage: "PROPUESTA",
      probability: 40,
      estimatedValue: 29607.59,
      expectedEventDate: new Date("2026-12-04"),
      pax: 200,
      observations:
        "Réplica de la cotización real del Excel. Fechas en evaluación: viernes 04 o sábado 05 de diciembre. 200 personas aproximadamente.",
    },
  });

  const event = await prisma.event.create({
    data: {
      opportunityId: opp.id,
      name: "Fiesta de Navidad Alimentos Mary",
      startDate: new Date("2026-12-04"),
      datesTentative: true,
      altDates: "viernes 04 o sábado 05 de diciembre de 2026",
      startTime: "15:00",
      endTime: "02:00",
      pax: 200,
      paxApproximate: true,
    },
  });

  const issueDate = new Date();
  const validUntil = new Date(issueDate.getTime() + 7 * 24 * 3600 * 1000);
  const quote = await prisma.quote.create({
    data: {
      number: "COT-2026-9001",
      version: 1,
      opportunityId: opp.id,
      eventId: event.id,
      signerId: kristian.id,
      status: "ENVIADA",
      issueDate,
      validUntil,
      publicToken: nanoid(12),
      clientMessage: greeting,
      legalConditions: legal,
      taxPct: 16,
      servicePct: 10,
      serviceEnabled: true,
      depositPct: 10,
      depositEnabled: true,
      igtfPct: 3,
      igtfEnabled: true,
      subtotalMisc: totals.subtotalMisc,
      subtotalTransfers: totals.subtotalTransfers,
      subtotalFood: totals.subtotalFood,
      subtotalSpaces: totals.subtotalSpaces,
      serviceAmount: totals.serviceAmount,
      taxAmount: totals.taxAmount,
      totalUsd: totals.totalUsd,
      depositAmount: totals.depositAmount,
      lines: {
        create: lines.map((l) => ({
          section: l.section,
          description: l.description,
          comment: l.comment ?? null,
          listPrice: l.listPrice ?? null,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          unit: l.unit,
          subtotal: round2(l.unitPrice * l.quantity),
          taxExempt: l.taxExempt ?? false,
          unitCost: l.unitCost ?? null,
          totalCost: l.unitCost != null ? round2(l.unitCost * l.quantity) : null,
          sortOrder: l.sortOrder,
        })),
      },
    },
  });
  await prisma.activity.create({
    data: {
      userId: kristian.id,
      opportunityId: opp.id,
      quoteId: quote.id,
      type: "SISTEMA",
      body: `Cotización ${quote.number} creada y enviada al cliente (demo basada en el Excel real).`,
    },
  });
  console.log(`✔ Cotización demo ${quote.number} (ENVIADA) — link público: /cotizacion/${quote.publicToken}`);

  // Reservas tentativas del evento de diciembre
  const spaces = await prisma.space.findMany();
  const byName = (n: string) => spaces.find((s) => s.name.toLowerCase().includes(n.toLowerCase()));
  const dec = [
    { space: byName("Estar General"), date: new Date("2026-12-04") },
    { space: byName("Terraza"), date: new Date("2026-12-04") },
    { space: byName("La Boite"), date: new Date("2026-12-04") },
  ];
  for (const r of dec) {
    if (!r.space) continue;
    await prisma.spaceReservation.create({
      data: {
        spaceId: r.space.id,
        eventId: event.id,
        date: r.date,
        startTime: "15:00",
        endTime: "02:00",
        status: "TENTATIVA",
        notes: "Pendiente de confirmación de fecha (04 o 05 dic)",
      },
    });
  }
  console.log("✔ 3 reservas TENTATIVAS para el 04-dic-2026");

  // ── Eventos confirmados este mes (para que el calendario tenga vida) ──
  const won = await prisma.opportunity.findMany({
    where: { stage: "GANADO", id: { not: opp.id } },
    take: 3,
    include: { client: true },
  });
  const now = new Date();
  // Medianoche UTC (canónico) para que coincida con el calendario y los chequeos
  const mk = (d: number) => new Date(Date.UTC(now.getFullYear(), now.getMonth(), d));
  const demoDays = [18, 22, 27];
  const demoSpaces = [byName("Bar Mirador"), byName("Estar General"), byName("Bar Gaviota")];
  for (let i = 0; i < won.length; i++) {
    const o = won[i];
    const sp = demoSpaces[i] ?? spaces[i];
    if (!sp) continue;
    const ev = await prisma.event.create({
      data: {
        opportunityId: o.id,
        name: o.title,
        startDate: mk(demoDays[i]),
        pax: o.pax ?? 80 + i * 40,
        status: "CONFIRMADO",
      },
    });
    await prisma.spaceReservation.create({
      data: {
        spaceId: sp.id,
        eventId: ev.id,
        date: mk(demoDays[i]),
        startTime: "10:00",
        endTime: "18:00",
        status: "CONFIRMADA",
      },
    });
    console.log(`✔ Evento confirmado "${o.title}" — ${sp.name}, ${demoDays[i]}/${now.getMonth() + 1}`);
  }

  console.log("\n🏁 Demo sembrada.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
