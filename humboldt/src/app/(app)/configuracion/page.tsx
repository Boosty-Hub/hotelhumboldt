import { redirect } from "next/navigation";
import { auth, canManageSettings } from "@/lib/auth";

// La sección de Configuración usa sub-rutas con su propio menú lateral.
// La raíz lleva al primer módulo según el rol: ajustes para gerencia,
// catálogo para el resto (ejecutivos).
export default async function ConfiguracionIndex() {
  const session = await auth();
  const role = session?.user?.role;
  const isManager = canManageSettings(role) || role === "GERENTE";
  redirect(isManager ? "/configuracion/parametros" : "/configuracion/catalogo");
}
