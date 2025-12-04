export function SummarySkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 bg-blue-100 rounded-full w-full animate-skeleton"></div>
      <div className="h-4 bg-blue-100 rounded-full w-full animate-skeleton" style={{ animationDelay: '0.1s' }}></div>
      <div className="h-4 bg-blue-100 rounded-full w-11/12 animate-skeleton" style={{ animationDelay: '0.2s' }}></div>
      <div className="h-4 bg-blue-100 rounded-full w-full animate-skeleton" style={{ animationDelay: '0.3s' }}></div>
      <div className="h-4 bg-blue-100 rounded-full w-4/5 animate-skeleton" style={{ animationDelay: '0.4s' }}></div>
    </div>
  );
}

export function SourcesSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg animate-skeleton" style={{ animationDelay: `${i * 0.1}s` }}></div>
            <div className="h-4 bg-blue-100 rounded w-24 animate-skeleton" style={{ animationDelay: `${i * 0.1 + 0.05}s` }}></div>
            <div className="h-5 bg-blue-100 rounded-full w-16 animate-skeleton" style={{ animationDelay: `${i * 0.1 + 0.1}s` }}></div>
          </div>
          <div className="h-5 bg-blue-100 rounded w-full mb-2 animate-skeleton" style={{ animationDelay: `${i * 0.1 + 0.15}s` }}></div>
          <div className="h-5 bg-blue-100 rounded w-3/4 animate-skeleton" style={{ animationDelay: `${i * 0.1 + 0.2}s` }}></div>
        </div>
      ))}
    </div>
  );
}