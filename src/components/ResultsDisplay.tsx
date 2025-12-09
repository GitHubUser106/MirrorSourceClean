import { ExternalLink, Link2, Check } from 'lucide-react';
import { useState } from 'react';

type SourceType = 'wire' | 'national' | 'international' | 'local' | 'public' | 'magazine' | 'reference' | 'syndication' | 'archive';

interface SourceResult {
  uri: string;
  title: string;
  displayName?: string;
  sourceDomain?: string;
  sourceType?: SourceType;
  isSyndicated?: boolean;
}

interface ResultsDisplayProps {
  results: SourceResult[] | null;
}

// Source type badge styling and labels
const sourceTypeBadge: Record<SourceType, { label: string; className: string }> = {
  wire: { 
    label: 'Wire Service', 
    className: 'bg-amber-100 text-amber-700 border-amber-200' 
  },
  public: { 
    label: 'Public Media', 
    className: 'bg-green-100 text-green-700 border-green-200' 
  },
  national: { 
    label: 'National', 
    className: 'bg-blue-100 text-blue-700 border-blue-200' 
  },
  international: { 
    label: 'International', 
    className: 'bg-purple-100 text-purple-700 border-purple-200' 
  },
  magazine: { 
    label: 'Magazine', 
    className: 'bg-pink-100 text-pink-700 border-pink-200' 
  },
  reference: { 
    label: 'Reference', 
    className: 'bg-slate-100 text-slate-700 border-slate-200' 
  },
  local: { 
    label: 'Local News', 
    className: 'bg-cyan-100 text-cyan-700 border-cyan-200' 
  },
  syndication: { 
    label: 'Free Access', 
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200' 
  },
  archive: { 
    label: 'Archived', 
    className: 'bg-orange-100 text-orange-700 border-orange-200' 
  },
};

function getFaviconUrl(sourceDomain: string): string {
  if (!sourceDomain) return '/favicon.ico';
  const cleanDomain = sourceDomain.replace(/^www\./, '');
  return `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`;
}

function getHeadline(result: SourceResult): string {
  if (result.title && !result.title.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
    return result.title;
  }
  return `Read article on ${result.sourceDomain || 'source'}`;
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  const [linksCopied, setLinksCopied] = useState(false);

  if (!results || results.length === 0) {
    return null;
  }

  async function handleCopyAllLinks() {
    if (!results) return;
    const links = results.map(r => r.uri).join('\n');
    try {
      await navigator.clipboard.writeText(links);
      setLinksCopied(true);
      setTimeout(() => setLinksCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy links:', err);
    }
  }

  return (
    <div className="space-y-4">
      {/* Two-column grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((item, index) => {
          const sourceDomain = item.sourceDomain || '';
          const displayName = item.displayName || 'SOURCE';
          const favicon = getFaviconUrl(sourceDomain);
          const headline = getHeadline(item);
          const sourceType = item.sourceType || 'local';
          
          // Safely get badge with fallback
          const badge = sourceTypeBadge[sourceType] || sourceTypeBadge['local'];

          return (
            <article
              key={index}
              className="group relative bg-white rounded-xl border border-slate-200 shadow-sm p-4 transition-all hover:bg-slate-50 hover:shadow-md hover:border-slate-300"
            >
              <a
                href={item.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-2"
              >
                {/* Source badge row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <img 
                    src={favicon} 
                    alt="" 
                    className="w-5 h-5 object-contain flex-shrink-0 rounded"
                    onError={(e) => { 
                      (e.target as HTMLImageElement).style.display = 'none'; 
                    }} 
                  />
                  <span className="text-sm font-bold uppercase tracking-wide text-blue-600">
                    {displayName}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                  {item.isSyndicated && (
                    <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-emerald-100 text-emerald-700 border-emerald-200">
                      ✓ Free Version
                    </span>
                  )}
                </div>

                {/* Headline */}
                <h3 className="text-sm font-medium text-slate-800 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
                  {headline}
                </h3>
                
                {/* External link icon */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                  <ExternalLink size={16} />
                </div>
              </a>
            </article>
          );
        })}
      </div>

      {/* Copy all links button */}
      {results.length > 1 && (
        <button
          onClick={handleCopyAllLinks}
          className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-blue-600 py-2 mt-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          {linksCopied ? (
            <>
              <Check size={16} className="text-green-600" />
              <span className="text-green-600">All links copied!</span>
            </>
          ) : (
            <>
              <Link2 size={16} />
              <span>Copy all links</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}