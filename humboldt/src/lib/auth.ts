import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { headers } from "next/headers";
import type { Role } from "./constants";
import {
  isValidPinFormat,
  verifyUserPin,
  ipFromHeaders,
  checkPinRateLimit,
  recordPinFailure,
  clearPinFailures,
} from "./pin";

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: Role;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Sesión de jornada laboral (8 h) con refresco horario, no los 30 días por
  // defecto: el JWT lleva el rol que autoriza los server actions.
  session: { strategy: "jwt", maxAge: 60 * 60 * 8, updateAge: 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Los correos se guardan en minúsculas → normalizar para que el login
        // no falle si el usuario teclea mayúsculas.
        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    Credentials({
      id: "pin",
      name: "PIN",
      credentials: {
        userId: { label: "Usuario", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      // El rate limiting vive AQUÍ, no en la server action: este provider es
      // alcanzable directo por HTTP en /api/auth/callback/pin, así que es el
      // ÚNICO punto que SIEMPRE se ejecuta para autenticar por PIN. Si el throttle
      // estuviera solo en loginWithPinAction, un POST directo al callback lo
      // saltearía (fuerza bruta del PIN sin límite).
      async authorize(credentials) {
        const userId = credentials?.userId as string | undefined;
        const pin = credentials?.pin as string | undefined;
        if (!userId || !pin || !isValidPinFormat(pin)) return null;

        let ip = "local";
        try {
          ip = ipFromHeaders(await headers());
        } catch {
          // headers() fuera de contexto de request → clave por defecto.
        }
        if (!checkPinRateLimit(userId, ip).allowed) return null; // bloqueado: deniega

        const user = await verifyUserPin(userId, pin);
        if (!user) {
          recordPinFailure(userId, ip);
          return null;
        }
        clearPinFailures(userId, ip);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? "EJECUTIVO";
      }
      return session;
    },
  },
});

/** ¿Puede ver costos internos y márgenes? */
export function canViewCosts(role: string | undefined): boolean {
  return role === "ADMIN" || role === "GERENTE";
}

/** ¿Puede administrar configuración y usuarios? */
export function canManageSettings(role: string | undefined): boolean {
  return role === "ADMIN";
}

/** ¿Puede borrar cotizaciones (acción destructiva)? Admin y Gerente. */
export function canDeleteQuotes(role: string | undefined): boolean {
  return role === "ADMIN" || role === "GERENTE";
}
