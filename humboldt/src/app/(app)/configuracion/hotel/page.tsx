import { prisma } from "@/lib/prisma";
import { HotelForm } from "../components/hotel-form";

export const metadata = { title: "Datos del hotel" };

export default async function HotelPage() {
  const settings = await prisma.setting.findMany();
  const hotelValues = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return <HotelForm values={hotelValues} />;
}
