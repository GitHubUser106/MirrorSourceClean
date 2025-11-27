export function SummarySkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-slate-200 rounded w-full"></div>
      <div className="h-4 bg-slate-200 rounded w-full"></div>
      <div className="h-4 bg-slate-200 rounded w-11/12"></div>
      <div className="h-4 bg-slate-200 rounded w-full"></div>
      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
    </div>
  );
}

export function SourceCardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 bg-slate-200 rounded"></div>
        <div className="h-3 bg-slate-200 rounded w-20"></div>
      </div>
      <div className="h-4 bg-slate-200 rounded w-full mb-1"></div>
      <div className="h-4 bg-slate-200 rounded w-4/5"></div>
    </div>
  );
}

export function SourcesSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      <SourceCardSkeleton />
      <SourceCardSkeleton />
      <SourceCardSkeleton />
      <SourceCardSkeleton />
    </div>
  );
}