// Carga y arma los datos del documento de cotización (props planas), compartido
// por la vista HTML (cotizaciones/[id]) y por el render PDF nativo (ruta /pdf).
// Así ambos muestran EXACTAMENTE lo mismo.

import { isSameDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { calcQuoteTotals } from "@/lib/quote-calc";
import { formatDayEs } from "@/lib/dates";
import { SETTING_KEYS } from "@/lib/constants";
import { quoteBaseNumber } from "@/components/quote/quote-utils";
import type { QuoteDocumentProps } from "@/components/quote/quote-document";

export interface QuoteDocData {
  props: QuoteDocumentProps;
  fileName: string;
  status: string;
}

/** Carga la cotización y arma las props del documento. null si no existe. */
export async function loadQuoteDocData(id: string): Promise<QuoteDocData | null> {
  const hotelKeys = [
    SETTING_KEYS.HOTEL_NAME,
    SETTING_KEYS.HOTEL_RIF,
    SETTING_KEYS.HOTEL_ADDRESS,
    SETTING_KEYS.HOTEL_PHONE,
    SETTING_KEYS.HOTEL_EMAIL,
  ];
  const [quote, settings] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: {
        opportunity: { include: { client: true, contact: true } },
        event: true,
        signer: { select: { name: true, email: true } },
        lines: { orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }] },
      },
    }),
    prisma.setting.findMany({ where: { key: { in: hotelKeys } } }),
  ]);
  if (!quote) return null;
  const setting = (key: string) => settings.find((s) => s.key === key)?.value ?? null;

  const totals = calcQuoteTotals(
    quote.lines.map((l) => ({
      section: l.section,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      isOptional: l.isOptional,
      taxExempt: l.taxExempt,
      unitCost: l.unitCost,
      costQuantity: l.costQuantity,
    })),
    {
      taxPct: quote.taxPct,
      taxEnabled: quote.taxEnabled,
      servicePct: quote.servicePct,
      serviceEnabled: quote.serviceEnabled,
      depositPct: quote.depositPct,
      depositEnabled: quote.depositEnabled,
      igtfPct: quote.igtfPct,
      igtfEnabled: quote.igtfEnabled,
    },
    quote.managerDiscountPct
  );

  const event = quote.event;
  let eventDateLabel: string | null = null;
  if (event?.startDate) {
    if (event.endDate && !isSameDay(event.startDate, event.endDate)) {
      eventDateLabel = `Del ${formatDayEs(event.startDate, "d 'de' MMMM")} al ${formatDayEs(
        event.endDate,
        "d 'de' MMMM 'de' yyyy"
      )}`;
    } else {
      eventDateLabel = formatDayEs(event.startDate, "EEEE d 'de' MMMM 'de' yyyy");
      eventDateLabel = eventDateLabel.charAt(0).toUpperCase() + eventDateLabel.slice(1);
    }
  }
  const eventTimeLabel =
    event?.startTime && event?.endTime
      ? `De ${event.startTime} a ${event.endTime}`
      : event?.startTime
        ? `Desde las ${event.startTime}`
        : null;

  const client = quote.opportunity.client;

  const props: QuoteDocumentProps = {
    hotel: {
      name: setting(SETTING_KEYS.HOTEL_NAME) ?? "Hotel Humboldt",
      rif: setting(SETTING_KEYS.HOTEL_RIF),
      address: setting(SETTING_KEYS.HOTEL_ADDRESS),
      phone: setting(SETTING_KEYS.HOTEL_PHONE),
      email: setting(SETTING_KEYS.HOTEL_EMAIL),
    },
    number: quote.number,
    version: quote.version,
    issueDate: quote.issueDate.toISOString(),
    validUntil: quote.validUntil?.toISOString() ?? null,
    clientName: client ? client.legalName : quote.opportunity.contact?.name ?? "Sin empresa",
    clientBrand: client?.brandName ?? null,
    clientRif: client?.rif ?? null,
    contactName: quote.opportunity.contact?.name ?? null,
    eventName: event?.name ?? quote.opportunity.title,
    eventDateLabel,
    eventTimeLabel,
    eventPax: event?.pax ?? null,
    paxApproximate: event?.paxApproximate ?? false,
    datesTentative: event?.datesTentative ?? false,
    clientMessage: quote.clientMessage,
    legalConditions: quote.legalConditions,
    signerName: quote.signer.name,
    signerEmail: quote.signer.email,
    lines: quote.lines.map((l) => ({
      section: l.section,
      dayNumber: l.dayNumber,
      description: l.description,
      comment: l.comment,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      subtotal: l.subtotal,
      isOptional: l.isOptional,
    })),
    totals: {
      subtotalMisc: totals.subtotalMisc,
      subtotalTransfers: totals.subtotalTransfers,
      subtotalFood: totals.subtotalFood,
      subtotalSpaces: totals.subtotalSpaces,
      discountPct: totals.discountPct,
      discountAmount: totals.discountAmount,
      taxableBase: totals.taxableBase,
      serviceAmount: totals.serviceAmount,
      taxAmount: totals.taxAmount,
      totalUsd: totals.totalUsd,
      depositAmount: totals.depositAmount,
      totalWithDeposit: totals.totalWithDeposit,
      igtfAmount: totals.igtfAmount,
    },
    params: {
      taxPct: quote.taxPct,
      taxEnabled: quote.taxEnabled,
      servicePct: quote.servicePct,
      serviceEnabled: quote.serviceEnabled,
      depositPct: quote.depositPct,
      depositEnabled: quote.depositEnabled,
      igtfPct: quote.igtfPct,
      igtfEnabled: quote.igtfEnabled,
    },
  };

  const base = quoteBaseNumber(quote.number);
  const fileName = `Cotizacion ${base}${quote.version > 1 ? ` v${quote.version}` : ""}.pdf`;

  return { props, fileName, status: quote.status };
}
