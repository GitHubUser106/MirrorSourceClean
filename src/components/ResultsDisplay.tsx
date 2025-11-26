import { ExternalLink } from 'lucide-react';

// Extended type to include sourceDomain from our API
interface SourceResult {
  uri: string;
  title: string;
  displayName?: string;
  sourceDomain?: string;
}

interface ResultsDisplayProps {
  results: SourceResult[] | null;
}

// --- Get Favicon URL using the source domain (not the Google search URL) ---
function getFaviconUrl(sourceDomain: string): string {
  if (!sourceDomain) return '/favicon.ico';
  const cleanDomain = sourceDomain.replace(/^www\./, '');
  return `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`;
}

// --- Get display name (prefer displayName, fall back to parsing domain) ---
function getDisplayName(result: SourceResult): string {
  if (result.displayName) return result.displayName;
  if (result.sourceDomain) {
    const parts = result.sourceDomain.split('.');
    return parts[0].toUpperCase();
  }
  return 'SOURCE';
}

// --- Get the source domain for favicon ---
function getSourceDomain(result: SourceResult): string {
  if (result.sourceDomain) return result.sourceDomain;
  // Fallback: try to extract from title if it looks like a domain
  if (result.title && result.title.includes('.')) {
    return result.title.toLowerCase().replace(/^www\./, '');
  }
  return '';
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-3">
      {results.map((item, index) => {
        const sourceDomain = getSourceDomain(item);
        const displayName = getDisplayName(item);
        const favicon = getFaviconUrl(sourceDomain);

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

              {/* Source domain as subtitle */}
              <p className="text-sm text-slate-600">
                View coverage on {sourceDomain}
              </p>
              
              {/* External Link Icon (appears on hover) */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                <ExternalLink size={16} />
              </div>
            </a>
          </article>
        );
      })}
    </div>
  );
}