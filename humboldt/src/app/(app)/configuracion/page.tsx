import { redirect } from "next/navigation";

// La sección de Configuración usa sub-rutas con su propio menú lateral.
// La raíz lleva al primer módulo.
export default function ConfiguracionIndex() {
  redirect("/configuracion/parametros");
}
