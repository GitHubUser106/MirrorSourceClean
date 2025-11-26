import { GroundingSource } from '../types';
import { ExternalLink } from 'lucide-react';

interface ResultsDisplayProps {
  results: GroundingSource[] | null;
}

// --- Domains to filter out (internal Google infrastructure) ---
const BLOCKED_DOMAINS = [
  'vertexaisearch.cloud.google.com',
  'googleusercontent.com',
];

// --- Helper: Check if URI is internal/blocked ---
function isBlockedUri(uri: string): boolean {
  try {
    const hostname = new URL(uri).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(blocked => hostname.includes(blocked));
  } catch {
    return true; // If we can't parse it, block it
  }
}

// --- Helper: Clean Hostname for Display ---
function getDisplayDomain(uri: string): string {
  try {
    const url = new URL(uri);
    // Remove www.
    return url.hostname.replace(/^www\./, '');
  } catch {
    return 'source.com';
  }
}

// --- Helper: Get Favicon URL (DuckDuckGo service) ---
function getFaviconUrl(uri: string): string {
  try {
    const hostname = new URL(uri).hostname;
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return '/favicon.ico';
  }
}

// --- Helper: Quality Filtering & Deduplication ---
function processResults(items: GroundingSource[]): GroundingSource[] {
  const uniqueMap = new Map<string, GroundingSource>();

  items.forEach(item => {
    // 1. Skip if no title or title matches URI (garbage)
    if (!item.title || item.title === item.uri) return;
    
    // 2. Skip blocked/internal URIs
    if (isBlockedUri(item.uri)) return;

    // 3. Get hostname as the dedup key
    let hostname = 'unknown';
    try {
      hostname = new URL(item.uri).hostname.replace(/^www\./, '').toLowerCase();
    } catch { 
      return; 
    }

    // 4. Skip if title is just the domain name
    if (item.title.toLowerCase() === hostname) return;

    // 5. Deduplication: Keep the one with the longest title (more descriptive)
    const existing = uniqueMap.get(hostname);
    if (!existing || (item.title.length > existing.title.length)) {
      uniqueMap.set(hostname, item);
    }
  });

  return Array.from(uniqueMap.values());
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (!results || results.length === 0) {
    return null;
  }

  // Apply Quality Filters
  const cleanResults = processResults(results);

  if (cleanResults.length === 0) return null;

  return (
    <div className="mt-6 space-y-3">
      {cleanResults.map((item, index) => {
        const domain = getDisplayDomain(item.uri);
        const favicon = getFaviconUrl(item.uri);

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
                  {domain}
                </span>
              </div>

              {/* HEADLINE */}
              <h3 className="text-base font-medium text-slate-800 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
                {item.title}
              </h3>
              
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