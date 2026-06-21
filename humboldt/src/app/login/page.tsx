import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  // Solo los usuarios activos CON PIN aparecen en el selector del login por PIN.
  // Exponemos únicamente id y nombre (nunca correo ni hash).
  const pinUsers = await prisma.user.findMany({
    where: { active: true, pinHash: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-900 p-10 text-white">
        <div className="flex items-center">
          <Logo variant="light" className="h-9 w-auto" priority />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Sistema Comercial
          </h1>
          <p className="text-sky-200 max-w-md text-balance">
            Pipeline de ventas, cotizaciones de eventos, calendario de salones y
            cobranza — todo en un solo lugar, a 2.105 metros sobre Caracas.
          </p>
        </div>
        <p className="text-xs text-sky-300/70">
          © {new Date().getFullYear()} Hotel Humboldt · Waraira Repano
        </p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="lg:hidden flex justify-center mb-4">
              <Logo className="h-14 w-auto" priority />
            </div>
            <h2 className="text-2xl font-bold">Bienvenido</h2>
            <p className="text-sm text-muted-foreground">
              Ingresa con tu cuenta del departamento comercial
            </p>
          </div>
          <Suspense fallback={<div className="h-48" aria-hidden />}>
            <LoginForm pinUsers={pinUsers} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
