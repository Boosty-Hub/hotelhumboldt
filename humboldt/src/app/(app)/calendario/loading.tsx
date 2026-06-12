import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function CalendarioLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        {/* Barra de herramientas */}
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-7 w-20" />
          </div>
          <Skeleton className="h-7 w-32" />
        </div>

        {/* Encabezado de días */}
        <div className="flex gap-1 border-b px-3 py-2">
          <Skeleton className="h-8 w-44 shrink-0" />
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="h-8 flex-1" />
          ))}
        </div>

        {/* Filas de salones */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-1 border-b px-3 py-2">
            <Skeleton className="h-10 w-44 shrink-0" />
            {Array.from({ length: 14 }).map((_, j) => (
              <Skeleton key={j} className="h-10 flex-1" />
            ))}
          </div>
        ))}

        {/* Leyenda */}
        <div className="flex items-center gap-4 bg-muted/30 px-3 py-2.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </Card>
    </div>
  );
}
