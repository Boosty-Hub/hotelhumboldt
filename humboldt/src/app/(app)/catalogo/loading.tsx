import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogoLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-7 w-36" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-7 w-36" />
        <Skeleton className="ml-auto h-5 w-32" />
      </div>

      <Card className="overflow-hidden py-0">
        <div className="border-b bg-muted/50 px-4 py-3">
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
