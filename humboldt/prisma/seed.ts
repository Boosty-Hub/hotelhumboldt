// Seed — datos reales extraídos de los Excel del Hotel Humboldt (_analysis/)
// Ejecutar: npx prisma db seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();
const DATA_DIR = join(__dirname, "seed-data");

function loadJson<T>(file: string): T | null {
  const p = join(DATA_DIR, file);
  if (!existsSync(p)) {
    console.warn(`⚠ seed-data/${file} no existe — usando fallback`);
    return null;
  }
  return JSON.parse(readFileSync(p, "utf-8")) as T;
}

// ── Tipos de los JSON generados desde los Excel ──────────────────────
interface SeedProduct {
  name: string;
  category: string;
  type: string;
  unit: string;
  listPrice: number | null;
  cost: number | null;
  supplier: string | null;
  minPax: number | null;
  unitsPerPax: number | null;
  priceContext: string | null;
  notes: string | null;
}
interface SeedSpace {
  name: string;
  dailyRate: number | null;
  capacity: number | null;
  notes: string | null;
}
interface SeedCatalogs {
  channels: string[];
  eventTypes: string[];
  statuses: string[];
  paymentMethods: string[];
  rejectReasons: string[];
}
interface SeedClient {
  name: string; // "IANCARINA C.A. (Alimentos Mary)" — razón social (marca)
  rif?: string | null;
  address?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}
interface SeedOpportunity {
  clientName: string;
  executive: string | null;
  channel: string | null;
  eventType: string | null;
  status: string | null;
  amountInitialUsd: number | null;
  amountFinalUsd: number | null;
  rooms: number | null;
  vg: number | null;
  supplierCost: number | null;
  rejectReason: string | null;
  observations: string | null;
  sentDate: string | null;
  eventDate: string | null;
}

// ── Mapeo de estados del tracker → etapas del pipeline ───────────────
function mapStage(status: string | null): { stage: string; probability: number } {
  const s = (status ?? "").toLowerCase();
  // Sin cotización migrada NO inventamos un "Ganado": un ganado real nace de
  // aprobar/contratar una cotización dentro del sistema. Los estados "cerrados"
  // del tracker entran como NEGOCIACION (oportunidad avanzada pero abierta).
  if (s.includes("realizado") || s.includes("pagado") || s.includes("ejecutada") || s.includes("aprobado"))
    return { stage: "NEGOCIACION", probability: 60 };
  if (s.includes("rechazado") || s.includes("perdido") || s.includes("suspendido"))
    return { stage: "PERDIDO", probability: 0 };
  if (s.includes("negociaci")) return { stage: "NEGOCIACION", probability: 60 };
  if (s.includes("seguimiento")) return { stage: "NEGOCIACION", probability: 50 };
  if (s.includes("enviado") || s.includes("espera")) return { stage: "PROPUESTA", probability: 40 };
  if (s.includes("solicitado")) return { stage: "NUEVO", probability: 10 };
  return { stage: "CONTACTADO", probability: 25 };
}

const SPACE_COLORS = [
  "#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#6366f1", "#f97316", "#14b8a6",
];

async function main() {
  console.log("🌱 Sembrando base de datos del Hotel Humboldt...");

  // ── 1. Usuarios (ejecutivos reales del tracker) ────────────────────
  // Contraseña del seed: NUNCA hardcodear. En producción es obligatoria por env
  // (SEED_PASSWORD). En desarrollo, si no se define, se genera una aleatoria por
  // usuario y se imprime UNA vez para la entrega inicial.
  const isProd = process.env.NODE_ENV === "production";
  const sharedSeedPassword = process.env.SEED_PASSWORD;
  if (isProd && !sharedSeedPassword) {
    throw new Error("SEED_PASSWORD es obligatoria en producción — abortando seed.");
  }

  const usersData = [
    // El admin genérico solo existe fuera de producción; en prod, cuentas nominales.
    ...(isProd ? [] : [{ name: "Administrador", email: "admin@hotelhumboldt.com", role: "ADMIN" }]),
    { name: "Gerente de Ventas", email: "gerencia@hotelhumboldt.com", role: "GERENTE" },
    { name: "Frenecis", email: "frenecis@hotelhumboldt.com", role: "EJECUTIVO" },
    { name: "Kristian Jaén", email: "kjaen@hotelhumboldt.com", role: "EJECUTIVO" },
    { name: "José", email: "jose@hotelhumboldt.com", role: "EJECUTIVO" },
    { name: "Malvis", email: "malvis@hotelhumboldt.com", role: "EJECUTIVO" },
  ];
  const users: Record<string, string> = {};
  const generatedCreds: { email: string; password: string }[] = [];
  for (const u of usersData) {
    // Password única por usuario: la de env (compartida) o una aleatoria fuerte.
    const plainPassword = sharedSeedPassword ?? randomBytes(12).toString("base64url");
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // no pisa la contraseña de usuarios ya existentes
      create: { ...u, passwordHash },
    });
    users[u.name.split(" ")[0].toLowerCase()] = user.id;
    if (!sharedSeedPassword) generatedCreds.push({ email: u.email, password: plainPassword });
  }
  console.log(`✔ ${usersData.length} usuarios`);
  if (!isProd && generatedCreds.length) {
    console.log("⚠ Credenciales generadas (solo dev, para usuarios NUEVOS — guardalas, no se vuelven a mostrar):");
    for (const c of generatedCreds) console.log(`   ${c.email}  ·  ${c.password}`);
  }

  // ── 2. Configuración comercial ─────────────────────────────────────
  const settings: { key: string; value: string; type: string; enabled: boolean; label: string; category: string }[] = [
    { key: "iva_pct", value: "16", type: "number", enabled: true, label: "IVA (%)", category: "impuestos" },
    { key: "service_pct", value: "10", type: "number", enabled: true, label: "Cargo de servicio sobre AyB (%)", category: "impuestos" },
    { key: "deposit_pct", value: "10", type: "number", enabled: true, label: "Garantía / depósito reembolsable (%)", category: "comercial" },
    { key: "igtf_pct", value: "3", type: "number", enabled: true, label: "IGTF pagos en divisas (%)", category: "impuestos" },
    { key: "quote_validity_days", value: "7", type: "number", enabled: true, label: "Vigencia de cotización (días)", category: "comercial" },
    { key: "default_markup_pct", value: "30", type: "number", enabled: true, label: "Markup por defecto sobre costo (%)", category: "comercial" },
    { key: "min_margin_pct", value: "20", type: "number", enabled: true, label: "Margen mínimo recomendado (%)", category: "comercial" },
    { key: "hotel_name", value: "Hotel Humboldt", type: "string", enabled: true, label: "Nombre del hotel", category: "hotel" },
    { key: "hotel_rif", value: "", type: "string", enabled: true, label: "RIF", category: "hotel" },
    { key: "hotel_address", value: "Parque Nacional Waraira Repano, Caracas, Venezuela", type: "string", enabled: true, label: "Dirección", category: "hotel" },
    { key: "hotel_phone", value: "", type: "string", enabled: true, label: "Teléfono", category: "hotel" },
    { key: "hotel_email", value: "ventas@hotelhumboldt.com", type: "string", enabled: true, label: "Correo de ventas", category: "hotel" },
    {
      key: "quote_greeting",
      value:
        "Reciba un cordial saludo del equipo del Hotel Humboldt. Es un placer presentarle nuestra propuesta para la realización de su evento, diseñada especialmente para usted.",
      type: "string", enabled: true, label: "Mensaje de cortesía", category: "comercial",
    },
    {
      key: "quote_legal_conditions",
      value: [
        "Los precios expresados en USD son de referencia; la facturación se realizará en bolívares a la tasa de cambio oficial BCV vigente el día de la emisión de la factura.",
        "El IVA (16%) será calculado y facturado en bolívares al momento de la facturación.",
        "Los pagos realizados en moneda extranjera generan IGTF (3%) según la normativa vigente.",
        "La presente cotización tiene una vigencia de 7 días continuos. Tarifas sujetas a cambio sin previo aviso.",
        "La garantía del 10% constituye un depósito reembolsable destinado a cubrir consumos adicionales o daños; será devuelta o aplicada al cierre del evento.",
        "La cotización no implica bloqueo ni reserva de espacios. La reserva se confirma con el pago acordado.",
        "El servicio de traslado en el Sistema Teleférico opera en su horario regular; consulte condiciones para horarios extendidos.",
        "Los menús están sujetos a disponibilidad de productos en el mercado; cualquier sustitución será notificada.",
        "El cargo de servicio (10%) aplica sobre alimentos y bebidas.",
        "Toda modificación posterior a la firma del acuerdo deberá constar por escrito.",
      ].join("\n"),
      type: "string", enabled: true, label: "Condiciones legales de cotización", category: "comercial",
    },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log(`✔ ${settings.length} parámetros de configuración`);

  // ── 3. Proveedores reales ──────────────────────────────────────────
  const suppliersData = [
    { name: "Alternativa Gastronómica 2023 C.A.", serviceType: "Catering", discountPct: 30, appliesIva: false, conditions: "30% de descuento fijo sobre precio sugerido. Precios no incluyen IVA ni 10% de servicio." },
    { name: "FIRIUS", serviceType: "Vinos y licores", discountPct: null, appliesIva: false, conditions: null },
    { name: "Evenplus", serviceType: "Audiovisuales", discountPct: null, appliesIva: true, conditions: "Cobra + IVA. Incluye transporte de equipos (camión)." },
    { name: "VENTEL", serviceType: "Teleférico / traslados", discountPct: null, appliesIva: false, conditions: "Traslado ida y vuelta antes de las 6:00 pm. Exento de IVA." },
    { name: "Deisy Oropeza", serviceType: "Actividades recreativas", discountPct: null, appliesIva: true, conditions: "Senderismo, yoga y actividades al aire libre. Cobra + IVA." },
    { name: "Festejos Mar", serviceType: "Mobiliario y festejos", discountPct: null, appliesIva: false, conditions: null },
  ];
  const suppliers: Record<string, string> = {};
  for (const s of suppliersData) {
    const sup = await prisma.supplier.upsert({ where: { name: s.name }, update: {}, create: s });
    suppliers[s.name] = sup.id;
  }
  console.log(`✔ ${suppliersData.length} proveedores`);

  // ── 4. Salones / espacios ──────────────────────────────────────────
  const spacesJson = loadJson<SeedSpace[]>("spaces.json");
  const spacesData: SeedSpace[] =
    spacesJson ?? [
      { name: "Bar Mirador (PH)", dailyRate: 3000, capacity: null, notes: null },
      { name: "Estar General", dailyRate: 3000, capacity: null, notes: null },
      { name: "Bar Gaviota", dailyRate: 1500, capacity: null, notes: null },
      { name: "Salón Redondo", dailyRate: 500, capacity: null, notes: "Usado también como camerino" },
      { name: "Terraza Norte y Sur", dailyRate: 1000, capacity: null, notes: null },
      { name: "Discoteca La Boite", dailyRate: 1000, capacity: null, notes: null },
      { name: "Antigua Estación", dailyRate: 1000, capacity: null, notes: null },
      { name: "Restaurante Bonpland", dailyRate: null, capacity: null, notes: "Sin tarifa publicada" },
      { name: "Restaurante Humboldt", dailyRate: null, capacity: null, notes: "Frecuentemente en cortesía" },
      { name: "Piscina", dailyRate: null, capacity: null, notes: "Sin tarifa publicada" },
    ];
  let i = 0;
  for (const sp of spacesData) {
    await prisma.space.upsert({
      where: { name: sp.name },
      update: {},
      create: {
        name: sp.name,
        dailyRate: sp.dailyRate,
        capacity: sp.capacity,
        capacityNotes: sp.notes,
        color: SPACE_COLORS[i % SPACE_COLORS.length],
        sortOrder: i++,
      },
    });
  }
  console.log(`✔ ${spacesData.length} salones`);

  // ── 5. Catálogos: tipos de evento y canales ────────────────────────
  const catalogs = loadJson<SeedCatalogs>("catalogs.json");
  const eventTypes = catalogs?.eventTypes?.length
    ? catalogs.eventTypes
    : ["Boda", "Fiesta de Navidad", "Convención", "Coctel", "Conferencia", "Congreso", "Hospedaje", "Sesión de fotos", "Graduación", "Cumpleaños", "Aniversario", "Lanzamiento de producto", "Team building", "Gala benéfica"];
  for (const name of eventTypes) {
    if (!name?.trim()) continue;
    await prisma.eventTypeOption.upsert({ where: { name: name.trim() }, update: {}, create: { name: name.trim() } });
  }
  const channels = catalogs?.channels?.length
    ? catalogs.channels
    : ["CRM", "Casa Matriz", "Gerente", "Director", "Contacto directo", "Caminante", "Referido", "Correo"];
  for (const name of channels) {
    if (!name?.trim()) continue;
    await prisma.channelOption.upsert({ where: { name: name.trim() }, update: {}, create: { name: name.trim() } });
  }
  console.log(`✔ ${eventTypes.length} tipos de evento, ${channels.length} canales`);

  // ── 6. Catálogo de productos ───────────────────────────────────────
  const products = loadJson<SeedProduct[]>("products.json") ?? [];
  if (products.length) {
    const categories = [...new Set(products.map((p) => p.category))];
    const catIds: Record<string, string> = {};
    let order = 0;
    for (const c of categories) {
      const cat = await prisma.productCategory.upsert({
        where: { name: c },
        update: {},
        create: { name: c, sortOrder: order++ },
      });
      catIds[c] = cat.id;
    }
    let created = 0;
    for (const p of products) {
      const existing = await prisma.product.findFirst({ where: { name: p.name } });
      if (existing) continue;
      await prisma.product.create({
        data: {
          name: p.name,
          categoryId: catIds[p.category],
          type: p.type || "PROPIO",
          unit: p.unit || "UND",
          listPrice: p.listPrice,
          cost: p.cost,
          supplierId: p.supplier ? suppliers[p.supplier] ?? suppliers["Alternativa Gastronómica 2023 C.A."] : null,
          minPax: p.minPax,
          unitsPerPax: p.unitsPerPax,
          priceContext: p.priceContext,
          notes: p.notes,
        },
      });
      created++;
    }
    console.log(`✔ ${created} productos en ${categories.length} categorías`);
  } else {
    console.warn("⚠ Sin products.json — catálogo vacío");
  }

  // ── 7. Clientes reales de los libros-evento ────────────────────────
  const clientsJson = loadJson<SeedClient[]>("clients-sample.json") ?? [];
  const clientIds: Record<string, string> = {};
  for (const c of clientsJson) {
    // "IANCARINA C.A. (Alimentos Mary)" → legal: IANCARINA C.A., marca: Alimentos Mary
    const m = c.name.match(/^(.*?)\s*\((.*)\)\s*$/);
    const legalName = (m ? m[1] : c.name).trim();
    const brandName = m ? m[2].trim() : null;
    const existing = await prisma.client.findFirst({ where: { legalName } });
    const client =
      existing ??
      (await prisma.client.create({
        data: {
          legalName,
          brandName,
          rif: c.rif ?? null,
          address: c.address ?? null,
          notes: c.notes ?? null,
          type: "EMPRESA",
          contacts: c.contactName
            ? {
                create: {
                  name: c.contactName,
                  phone: c.phone ?? null,
                  email: c.email ?? null,
                  isPrimary: true,
                },
              }
            : undefined,
        },
      }));
    clientIds[c.name] = client.id;
    clientIds[legalName] = client.id;
    if (brandName) clientIds[brandName] = client.id;
  }
  console.log(`✔ ${clientsJson.length} clientes de libros-evento`);

  // ── 8. Oportunidades reales del tracker ────────────────────────────
  const opps = loadJson<SeedOpportunity[]>("pipeline-sample.json") ?? [];
  const execMap: Record<string, string> = {
    frenecis: users["frenecis"],
    kristian: users["kristian"],
    "k. jaén": users["kristian"],
    jose: users["jose"],
    "josé": users["jose"],
    malvis: users["malvis"],
  };
  let oppCount = 0;
  let codeSeq = 1;
  for (const o of opps) {
    if (!o.clientName?.trim()) continue;
    // Cliente: buscar o crear
    let clientId = clientIds[o.clientName];
    if (!clientId) {
      const existing = await prisma.client.findFirst({ where: { legalName: o.clientName.trim() } });
      const client =
        existing ??
        (await prisma.client.create({
          data: { legalName: o.clientName.trim(), type: "EMPRESA" },
        }));
      clientId = client.id;
      clientIds[o.clientName] = clientId;
    }
    const { stage, probability } = mapStage(o.status);
    const ownerId = execMap[(o.executive ?? "").toLowerCase().trim()] ?? users["gerente"] ?? users["administrador"];
    const code = `OP-2026-${String(codeSeq++).padStart(4, "0")}`;
    await prisma.opportunity.create({
      data: {
        code,
        clientId,
        ownerId,
        title: o.eventType ? `${o.eventType} — ${o.clientName.trim()}` : o.clientName.trim(),
        eventType: o.eventType?.trim() || null,
        channel: o.channel?.trim() || null,
        stage,
        probability,
        estimatedValue: o.amountFinalUsd ?? o.amountInitialUsd ?? 0,
        roomsCount: o.rooms ?? 0,
        vgCount: o.vg ?? 0,
        lostReason: stage === "PERDIDO" ? o.rejectReason ?? null : null,
        observations: o.observations ?? null,
        expectedEventDate: o.eventDate ? new Date(o.eventDate) : null,
        createdAt: o.sentDate ? new Date(o.sentDate) : new Date(),
      },
    });
    oppCount++;
  }
  console.log(`✔ ${oppCount} oportunidades del tracker real`);

  // ── 9. Tasa de cambio inicial (fallback si la API BCV no responde) ─
  const existingRate = await prisma.exchangeRate.findFirst();
  if (!existingRate) {
    await prisma.exchangeRate.create({
      data: { date: new Date(), rate: 496.83, source: "MANUAL" },
    });
    console.log("✔ Tasa de cambio inicial (496,83 Bs/USD — última observada en los Excel)");
  }

  console.log("🏁 Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
