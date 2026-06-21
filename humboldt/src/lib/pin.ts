// Lógica de dominio del PIN de acceso (login rápido de 4 dígitos).
//
// Diseño: el login por PIN exige IDENTIFICACIÓN PREVIA — el usuario elige su
// cuenta y luego teclea el PIN. Eso permite:
//   - Comparar el PIN contra UN solo hash (O(1)), no contra todos los usuarios.
//   - Bloqueo POR USUARIO tras N fallos (en vez de un cap global que sería un
//     DoS para todos).
//   - PINs NO necesariamente únicos entre usuarios (cada uno se compara solo
//     contra el suyo) → sin lookup O(N) ni condición de carrera al asignarlos.
// Defensa del PIN: hash bcrypt + rechazo de PINs triviales + rate limit
// por-usuario y por-IP (más abajo).

import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const PIN_LENGTH = 4;
const BCRYPT_ROUNDS = 10;

/** Exactamente N dígitos numéricos. */
export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

// PINs estadísticamente más comunes (análisis DataGenetics) que NO caen en los
// patrones de abajo y conviene rechazar explícitamente.
const COMMON_PINS = new Set([
  "1004", "2000", "2580", "0852", "1379", "2468", "1357", "0123",
  "7410", "1593", "0987", "1235", "1230",
]);

/** PIN demasiado fácil de adivinar: repetidos, secuencias, pares, años o comunes. */
export function isTrivialPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true; // 0000, 1111, ...
  const ascending = "0123456789";
  const descending = "9876543210";
  if (ascending.includes(pin) || descending.includes(pin)) return true; // 1234, 4321
  // Pares repetidos: 1212, 6969, 3434, ...
  if (pin.length === 4 && pin[0] === pin[2] && pin[1] === pin[3]) return true;
  // Años plausibles: 1900-2099 (fechas de nacimiento típicas).
  if (/^(19|20)\d\d$/.test(pin)) return true;
  return COMMON_PINS.has(pin);
}

/** Valida formato + no-trivial. Devuelve el mensaje de error, o null si es válido. */
export function validatePin(pin: string): string | null {
  if (!isValidPinFormat(pin)) {
    return `El PIN debe tener exactamente ${PIN_LENGTH} dígitos.`;
  }
  if (isTrivialPin(pin)) {
    return "Ese PIN es demasiado fácil de adivinar. Evita secuencias (1234) o dígitos repetidos (1111).";
  }
  return null;
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

/**
 * Verifica el PIN contra UN usuario concreto (activo y con PIN configurado).
 * O(1): una sola lectura y una sola comparación bcrypt. Devuelve el usuario
 * (sin el hash) si coincide, o null.
 */
export async function verifyUserPin(userId: string, pin: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, active: true, pinHash: { not: null } },
    select: { id: true, name: true, email: true, role: true, pinHash: true },
  });
  if (!user?.pinHash) return null;
  if (!(await bcrypt.compare(pin, user.pinHash))) return null;
  const { pinHash: _pinHash, ...safe } = user;
  void _pinHash;
  return safe;
}

// ─────── Rate limiting en memoria: por-usuario (lockout) + por-IP (anti enumeración) ───────
//
// LIMITACIÓN CONOCIDA: el estado vive en memoria del proceso. Suficiente para una
// sola instancia y el tráfico interno de un hotel. En multi-instancia (varias
// réplicas) el contador NO se comparte → mover a Redis/Upstash o una tabla en la DB.
//
// NO hay cap global: un atacante NO puede bloquear el login por PIN de todos.
// Solo se bloquea al usuario atacado (por su PIN) y/o a la IP atacante.

const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_PER_USER = 5; // fallos por usuario → bloquea el PIN de ESE usuario
const MAX_PER_IP = 15; // fallos por IP → frena que una IP enumere muchos usuarios

type Bucket = number[]; // timestamps de intentos fallidos

const userBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number): Bucket {
  return bucket.filter((t) => now - t < WINDOW_MS);
}

function freshBucket(map: Map<string, Bucket>, key: string, now: number): Bucket {
  const bucket = prune(map.get(key) ?? [], now);
  map.set(key, bucket);
  return bucket;
}

export interface RateState {
  allowed: boolean;
  retryAfterSec: number;
}

/** ¿Puede intentarse un PIN para este usuario desde esta IP? */
export function checkPinRateLimit(userId: string, ip: string): RateState {
  const now = Date.now();
  const perUser = freshBucket(userBuckets, userId, now);
  const perIp = freshBucket(ipBuckets, ip, now);

  const overUser = perUser.length >= MAX_PER_USER;
  const overIp = perIp.length >= MAX_PER_IP;
  if (!overUser && !overIp) return { allowed: true, retryAfterSec: 0 };

  const blocking = overUser ? perUser : perIp;
  const oldest = blocking[0] ?? now;
  const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
  return { allowed: false, retryAfterSec };
}

/** Registra un intento fallido (cuenta para el usuario y para la IP). */
export function recordPinFailure(userId: string, ip: string): void {
  const now = Date.now();
  freshBucket(userBuckets, userId, now).push(now);
  freshBucket(ipBuckets, ip, now).push(now);
}

/** Limpia los fallos tras un login exitoso. */
export function clearPinFailures(userId: string, ip: string): void {
  userBuckets.delete(userId);
  ipBuckets.delete(ip);
}

/**
 * Extrae una IP para el rate limiting a partir de las cabeceras.
 * NO confiamos en el PRIMER valor de x-forwarded-for: es el más cercano al
 * cliente y es spoofeable. Preferimos x-real-ip (lo pone el proxy) o el ÚLTIMO
 * hop de XFF (agregado por nuestra infraestructura). Limitación: depende de que
 * haya un proxy de confianza delante; en self-hosting sin proxy es best-effort.
 */
export function ipFromHeaders(h: Headers): string {
  const real = h.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "local";
}
