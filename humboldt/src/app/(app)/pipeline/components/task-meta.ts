// Iconos por tipo de tarea (los labels viven en src/lib/constants.ts).
import { Repeat, FileText, PhoneCall, Banknote, Users, ListTodo } from "lucide-react";

export type IconComponent = React.ComponentType<{ className?: string }>;

export const TASK_TYPE_ICONS: Record<string, IconComponent> = {
  VOLVER_CONTACTAR: Repeat,
  ENVIAR_COTIZACION: FileText,
  LLAMAR: PhoneCall,
  GESTION_COBRO: Banknote,
  REUNION: Users,
  OTRO: ListTodo,
};
