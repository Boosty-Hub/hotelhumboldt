import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** "light" invierte el wordmark a blanco para fondos oscuros. */
  variant?: "default" | "light";
  /** Controlá el tamaño con clases de alto (ej. "h-10 w-auto"). */
  className?: string;
  /** Para logos above-the-fold (login, sidebar). */
  priority?: boolean;
}

// Dimensiones intrínsecas del asset transparente (recortado).
const LOGO_W = 344;
const LOGO_H = 379;

/** Wordmark "hotel Humboldt". Negro sobre fondo claro; usar variant="light" en oscuro. */
export function Logo({ variant = "default", className, priority }: LogoProps) {
  return (
    <Image
      src="/logo-hotel-humboldt.png"
      alt="Hotel Humboldt"
      width={LOGO_W}
      height={LOGO_H}
      priority={priority}
      className={cn(
        "h-10 w-auto select-none object-contain",
        variant === "light" && "brightness-0 invert",
        className
      )}
    />
  );
}
