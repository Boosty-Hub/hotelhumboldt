"use server";

import { headers } from "next/headers";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { isValidPinFormat, checkPinRateLimit, ipFromHeaders } from "@/lib/pin";

export async function loginAction(email: string, password: string) {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Correo o contraseña incorrectos" };
    }
    throw error;
  }
}

function rateLimitedMessage(retryAfterSec: number): string {
  const minutes = Math.ceil(retryAfterSec / 60);
  return `Demasiados intentos fallidos. Espera ${minutes} minuto${
    minutes === 1 ? "" : "s"
  } e intenta de nuevo.`;
}

export async function loginWithPinAction(userId: string, pin: string) {
  if (!userId) return { error: "Elegí tu usuario." };
  if (!isValidPinFormat(pin)) {
    return { error: "El PIN debe tener 4 dígitos." };
  }

  // El ENFORCE real del rate limit y el registro de fallos viven en authorize()
  // del provider "pin" (ver src/lib/auth.ts), porque ese provider es alcanzable
  // por HTTP directo. Acá solo leemos el estado para dar un mensaje claro.
  const ip = ipFromHeaders(await headers());
  const pre = checkPinRateLimit(userId, ip);
  if (!pre.allowed) {
    return { error: rateLimitedMessage(pre.retryAfterSec) };
  }

  try {
    await signIn("pin", { userId, pin, redirect: false });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      // authorize ya registró el fallo; si eso nos dejó bloqueados, avisamos.
      const post = checkPinRateLimit(userId, ip);
      return { error: post.allowed ? "PIN incorrecto." : rateLimitedMessage(post.retryAfterSec) };
    }
    throw error;
  }
}
