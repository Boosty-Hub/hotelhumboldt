import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentoLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-72" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-7 w-28" />
        </div>
      </div>
      <div className="space-y-6 rounded-xl border bg-white p-10">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="ml-auto h-6 w-36" />
            <Skeleton className="ml-auto h-3 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
        <div className="flex justify-end">
          <Skeleton className="h-40 w-80 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
