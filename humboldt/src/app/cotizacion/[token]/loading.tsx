import { Skeleton } from "@/components/ui/skeleton";

export default function CotizacionPublicaLoading() {
  return (
    <div className="min-h-screen bg-zinc-100">
      {/* Header de marca */}
      <div className="bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-900">
        <div className="mx-auto max-w-4xl px-4 pt-8 pb-14 sm:px-6 sm:pt-10 sm:pb-16">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-lg bg-white/15" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28 bg-white/15" />
              <Skeleton className="h-2.5 w-36 bg-white/10" />
            </div>
          </div>
          <Skeleton className="mt-7 h-3 w-44 bg-white/15" />
          <Skeleton className="mt-2.5 h-8 w-72 max-w-full bg-white/20" />
          <Skeleton className="mt-2 h-4 w-56 max-w-full bg-white/10" />
          <div className="mt-4 flex flex-wrap gap-4">
            <Skeleton className="h-4 w-44 bg-white/10" />
            <Skeleton className="h-4 w-28 bg-white/10" />
            <Skeleton className="h-4 w-24 bg-white/10" />
          </div>
        </div>
      </div>

      {/* Banner + documento */}
      <div className="mx-auto -mt-8 max-w-4xl space-y-4 px-3 pb-24 sm:px-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="flex justify-end">
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-10">
          <div className="flex justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-56" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-6 w-32" />
              <Skeleton className="ml-auto h-3 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
          <div className="flex justify-end">
            <Skeleton className="h-36 w-full max-w-sm rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
