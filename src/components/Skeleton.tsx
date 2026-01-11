'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200",
        className
      )}
      style={style}
    />
  );
}

// Card skeleton for source cards
export function SourceCardSkeleton() {
  return (
    <div className="border border-slate-200 rounded-xl p-6 bg-white h-[380px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-6 h-6 rounded-md" />
        <Skeleton className="h-5 w-32" />
      </div>

      {/* Badges */}
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>

      {/* Content lines */}
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-4/6 mb-4" />

      {/* More content */}
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-3/4 mb-2" />
      <Skeleton className="h-3 w-5/6 mb-6" />

      {/* Link */}
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}

// Summary skeleton
export function SummarySkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );
}

// Coverage distribution skeleton
export function CoverageDistributionSkeleton() {
  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-4 h-4" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Bars */}
      <div className="flex justify-center gap-4 pt-6">
        {[60, 40, 80, 50, 70].map((height, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-32 flex items-end mb-2">
              <Skeleton
                className="w-12 rounded-t-lg"
                style={{ height: `${height}%` }}
              />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Intel Brief skeleton
export function IntelBriefSkeleton() {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-5 h-5 rounded bg-slate-700" />
        <Skeleton className="h-5 w-24 bg-slate-700" />
      </div>

      {/* Divergence level */}
      <Skeleton className="h-6 w-32 rounded-full bg-slate-700 mb-4" />

      {/* Common ground */}
      <div className="mb-4">
        <Skeleton className="h-4 w-28 bg-slate-700 mb-2" />
        <Skeleton className="h-3 w-full bg-slate-700 mb-1" />
        <Skeleton className="h-3 w-5/6 bg-slate-700" />
      </div>

      {/* Key differences */}
      <div>
        <Skeleton className="h-4 w-32 bg-slate-700 mb-2" />
        <Skeleton className="h-3 w-full bg-slate-700 mb-1" />
        <Skeleton className="h-3 w-4/5 bg-slate-700" />
      </div>
    </div>
  );
}

// Full loading state with all skeletons
export function ResultsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <SummarySkeleton />

      {/* Coverage Distribution */}
      <CoverageDistributionSkeleton />

      {/* Intel Brief */}
      <IntelBriefSkeleton />

      {/* Source cards grid */}
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SourceCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
