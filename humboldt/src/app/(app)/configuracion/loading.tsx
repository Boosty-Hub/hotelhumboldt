import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ConfiguracionLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Encabezado */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Tabs */}
      <Skeleton className="h-9 w-full sm:w-[480px]" />

      {/* Cards de parámetros */}
      {[0, 1].map((card) => (
        <Card key={card}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-full max-w-md" />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-4 w-7 rounded-full" />
                  <Skeleton className="h-7 w-20" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
