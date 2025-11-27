import { ExternalLink, RefreshCw } from 'lucide-react';

interface SourceResult {
  uri: string;
  title: string;
  displayName?: string;
  sourceDomain?: string;
}

interface ResultsDisplayProps {
  results: SourceResult[] | null;
  onRetry?: () => void;
}

// --- Get Favicon URL using the source domain ---
function getFaviconUrl(sourceDomain: string): string {
  if (!sourceDomain) return '/favicon.ico';
  const cleanDomain = sourceDomain.replace(/^www\./, '');
  return `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`;
}

// --- Get display name for the source ---
function getDisplayName(result: SourceResult): string {
  if (result.displayName) return result.displayName;
  if (result.sourceDomain) {
    return result.sourceDomain.split('.')[0].toUpperCase();
  }
  return 'SOURCE';
}

// --- Get the source domain for favicon ---
function getSourceDomain(result: SourceResult): string {
  if (result.sourceDomain) return result.sourceDomain;
  if (result.title && result.title.includes('.')) {
    return result.title.toLowerCase().replace(/^www\./, '');
  }
  return '';
}

// --- Format the headline/title for display ---
function getHeadline(result: SourceResult): string {
  // If title looks like a domain (e.g., "theguardian.com"), don't use it as headline
  if (result.title && !result.title.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
    return result.title;
  }
  // Fallback to domain-based text
  return `Read article on ${result.sourceDomain || 'source'}`;
}

export default function ResultsDisplay({ results, onRetry }: ResultsDisplayProps) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-3">
      {results.map((item, index) => {
        const sourceDomain = getSourceDomain(item);
        const displayName = getDisplayName(item);
        const favicon = getFaviconUrl(sourceDomain);
        const headline = getHeadline(item);

        return (
          <article
            key={index}
            className="group relative bg-white rounded-lg border border-slate-200 p-4 transition-all hover:bg-slate-50 hover:shadow-sm"
          >
            <a
              href={item.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1.5"
            >
              {/* TOP ROW: Favicon + Source Name */}
              <div className="flex items-center gap-2">
                <img 
                  src={favicon} 
                  alt="" 
                  className="w-4 h-4 object-contain"
                  onError={(e) => { 
                    (e.target as HTMLImageElement).style.display = 'none'; 
                  }} 
                />
                <span className="text-xs font-bold uppercase tracking-wide text-blue-600">
                  {displayName}
                </span>
              </div>

              {/* Headline */}
              <h3 className="text-base font-medium text-slate-800 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
                {headline}
              </h3>
              
              {/* External Link Icon (appears on hover) */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                <ExternalLink size={16} />
              </div>
            </a>
          </article>
        );
      })}

      {/* Retry Section */}
      <div className="pt-4 border-t border-slate-200 mt-4">
        <p className="text-sm text-slate-500 text-center mb-3">
          Results may vary. Look for others to try again.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-full transition-colors"
          >
            <RefreshCw size={18} />
            Look for other sources
          </button>
        )}
      </div>
    </div>
  );
}