import { redirect } from "next/navigation";
import { auth, canManageSettings } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HotelForm } from "../components/hotel-form";

export const metadata = { title: "Datos del hotel" };

export default async function HotelPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (!canManageSettings(role) && role !== "GERENTE") redirect("/configuracion/catalogo");

  const settings = await prisma.setting.findMany();
  const hotelValues = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return <HotelForm values={hotelValues} />;
}
