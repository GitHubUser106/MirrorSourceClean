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
  isLoading?: boolean;
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
  if (result.title && !result.title.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
    return result.title;
  }
  return `Read article on ${result.sourceDomain || 'source'}`;
}

export default function ResultsDisplay({ results, onRetry, isLoading }: ResultsDisplayProps) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {results.map((item, index) => {
        const sourceDomain = getSourceDomain(item);
        const displayName = getDisplayName(item);
        const favicon = getFaviconUrl(sourceDomain);
        const headline = getHeadline(item);

        return (
          <article
            key={index}
            className="group relative bg-white rounded-lg border border-slate-200 p-4 md:p-5 transition-all hover:bg-slate-50 hover:shadow-sm"
          >
            <a
              href={item.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-2"
            >
              {/* TOP ROW: Favicon + Source Name - BIGGER for mobile */}
              <div className="flex items-center gap-2.5">
                <img 
                  src={favicon} 
                  alt="" 
                  className="w-5 h-5 md:w-6 md:h-6 object-contain flex-shrink-0"
                  onError={(e) => { 
                    (e.target as HTMLImageElement).style.display = 'none'; 
                  }} 
                />
                <span className="text-sm font-bold uppercase tracking-wide text-blue-600">
                  {displayName}
                </span>
              </div>

              {/* Headline - larger text for readability */}
              <h3 className="text-base md:text-lg font-medium text-slate-800 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
                {headline}
              </h3>
              
              {/* External Link Icon */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                <ExternalLink size={18} />
              </div>
            </a>
          </article>
        );
      })}

      {/* Retry Section */}
      <div className="pt-4 border-t border-slate-100 mt-6">
        <p className="text-sm text-slate-500 text-center mb-3">
          Results may vary. Look for others to try again.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-full transition-colors"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Look for other sources
          </button>
        )}
      </div>
    </div>
  );
}