import { Skeleton } from "@/components/ui/skeleton";

export default function NuevaCotizacionLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="flex justify-end gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-32" />
      </div>
    </div>
  );
}
