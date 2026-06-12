import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Encabezado */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-40" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>

      {/* Columnas kanban */}
      <div className="flex flex-1 gap-3 overflow-hidden pb-2">
        {Array.from({ length: 6 }).map((_, col) => (
          <div
            key={col}
            className="flex w-[280px] shrink-0 flex-col gap-2 rounded-xl border bg-muted/40 p-2"
          >
            <div className="flex items-center justify-between px-1.5 py-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-14" />
            </div>
            {Array.from({ length: col % 3 === 2 ? 2 : 3 }).map((_, card) => (
              <div key={card} className="space-y-2 rounded-lg border bg-background p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex justify-between pt-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
