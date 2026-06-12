import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { Mountain } from "lucide-react";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-900 p-10 text-white">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Mountain className="h-6 w-6" />
          Hotel Humboldt
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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-950 text-white">
                <Mountain className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">Bienvenido</h2>
            <p className="text-sm text-muted-foreground">
              Ingresa con tu cuenta del departamento comercial
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
