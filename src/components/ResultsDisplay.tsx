import { ExternalLink, Link2, Check } from 'lucide-react';
import { useState } from 'react';

type SourceType = 
  | 'wire' 
  | 'public' 
  | 'corporate' 
  | 'state'
  | 'analysis' 
  | 'local' 
  | 'national' 
  | 'international' 
  | 'magazine' 
  | 'specialized'
  | 'reference' 
  | 'syndication' 
  | 'archive';

interface SourceResult {
  uri: string;
  title: string;
  displayName?: string;
  sourceDomain?: string;
  sourceType?: SourceType;
  countryCode?: string;
  isSyndicated?: boolean;
}

interface ResultsDisplayProps {
  results: SourceResult[] | null;
}

// Country flag emoji mapping
const countryFlags: Record<string, { flag: string; label: string }> = {
  US: { flag: '🇺🇸', label: 'US' },
  UK: { flag: '🇬🇧', label: 'UK' },
  GB: { flag: '🇬🇧', label: 'UK' },
  EU: { flag: '🇪🇺', label: 'EU' },
  CA: { flag: '🇨🇦', label: 'CA' },
  AU: { flag: '🇦🇺', label: 'AU' },
  DE: { flag: '🇩🇪', label: 'DE' },
  FR: { flag: '🇫🇷', label: 'FR' },
  JP: { flag: '🇯🇵', label: 'JP' },
  IN: { flag: '🇮🇳', label: 'IN' },
  CN: { flag: '🇨🇳', label: 'CN' },
  BR: { flag: '🇧🇷', label: 'BR' },
  MX: { flag: '🇲🇽', label: 'MX' },
  KR: { flag: '🇰🇷', label: 'KR' },
  IT: { flag: '🇮🇹', label: 'IT' },
  ES: { flag: '🇪🇸', label: 'ES' },
  NL: { flag: '🇳🇱', label: 'NL' },
  CH: { flag: '🇨🇭', label: 'CH' },
  SE: { flag: '🇸🇪', label: 'SE' },
  NZ: { flag: '🇳🇿', label: 'NZ' },
  IE: { flag: '🇮🇪', label: 'IE' },
  IL: { flag: '🇮🇱', label: 'IL' },
  AE: { flag: '🇦🇪', label: 'AE' },
  SG: { flag: '🇸🇬', label: 'SG' },
  QA: { flag: '🇶🇦', label: 'QA' },
  INT: { flag: '🌐', label: 'Intl' },
};

// Source type badge styling and labels - expanded taxonomy
const sourceTypeBadge: Record<SourceType, { label: string; className: string; icon?: string }> = {
  wire: { 
    label: 'Wire', 
    className: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: '⚡'
  },
  public: { 
    label: 'Public', 
    className: 'bg-green-100 text-green-800 border-green-300',
    icon: '🏛️'
  },
  state: { 
    label: 'State', 
    className: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    icon: '🏛️'
  },
  corporate: { 
    label: 'Corporate', 
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: '🏢'
  },
  analysis: { 
    label: 'Analysis', 
    className: 'bg-violet-100 text-violet-800 border-violet-300',
    icon: '🧠'
  },
  national: { 
    label: 'National', 
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: '📰'
  },
  international: { 
    label: 'International', 
    className: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: '🌍'
  },
  magazine: { 
    label: 'Magazine', 
    className: 'bg-pink-100 text-pink-800 border-pink-300',
    icon: '📖'
  },
  local: { 
    label: 'Local News', 
    className: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    icon: '📍'
  },
  specialized: { 
    label: 'Specialized', 
    className: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: '🎯'
  },
  reference: { 
    label: 'Reference', 
    className: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: '📚'
  },
  syndication: { 
    label: 'Free Access', 
    className: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    icon: '✓'
  },
  archive: { 
    label: 'Archived', 
    className: 'bg-orange-100 text-orange-700 border-orange-300',
    icon: '🗄️'
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
          const displayName = item.displayName || sourceDomain.replace(/^www\./, '').toUpperCase();
          const favicon = getFaviconUrl(sourceDomain);
          const headline = getHeadline(item);
          const sourceType = item.sourceType || 'corporate';
          const countryCode = item.countryCode || 'US';
          
          // Get badge info with fallback
          const badge = sourceTypeBadge[sourceType] || sourceTypeBadge['corporate'];
          const country = countryFlags[countryCode] || countryFlags['US'];
          
          // Citation number (1-indexed)
          const citationNum = index + 1;

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
                {/* Source info row with badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Favicon */}
                  <img 
                    src={favicon} 
                    alt="" 
                    className="w-5 h-5 object-contain flex-shrink-0 rounded"
                    onError={(e) => { 
                      (e.target as HTMLImageElement).style.display = 'none'; 
                    }} 
                  />
                  
                  {/* Source name */}
                  <span className="text-sm font-bold uppercase tracking-wide text-blue-600">
                    {displayName}
                  </span>
                  
                  {/* Country badge */}
                  <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600">
                    <span>{country.flag}</span>
                    <span className="font-medium">{country.label}</span>
                  </span>
                  
                  {/* Source type badge */}
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium ${badge.className}`}>
                    {badge.icon && <span className="text-[10px]">{badge.icon}</span>}
                    {badge.label}
                  </span>
                  
                  {/* Citation number */}
                  <span className="inline-flex items-center justify-center text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 min-w-[24px]">
                    [{citationNum}]
                  </span>
                  
                  {/* Free version badge if syndicated */}
                  {item.isSyndicated && (
                    <span className="text-xs px-2 py-0.5 rounded border font-medium bg-emerald-100 text-emerald-700 border-emerald-300">
                      ✓ Free
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