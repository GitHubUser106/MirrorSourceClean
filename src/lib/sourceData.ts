/**
 * SINGLE SOURCE OF TRUTH for all news outlet metadata
 * Used by: Coverage Distribution, Compare Cards, Auto-Select, Sources Page
 */

export type PoliticalLean = 'left' | 'center-left' | 'center' | 'center-right' | 'right';
export type SourceType = 'Wire' | 'Public-Trust' | 'State-Funded' | 'Nonprofit' | 'Corporate' | 'National' | 'International' | 'Magazine' | 'Analysis' | 'Specialized' | 'Local';

export interface SourceEntry {
  name: string;
  lean: PoliticalLean;
  type: SourceType;
}

// =============================================================================
// THE SOURCE DATABASE - Single source of truth for all outlet metadata
// =============================================================================
export const SOURCE_DATABASE: Record<string, SourceEntry> = {
  // WIRE SERVICES
  'apnews.com': { name: 'AP News', lean: 'left', type: 'Wire' },  // AllSides Dec 2024: Left
  'reuters.com': { name: 'Reuters', lean: 'center', type: 'Wire' },
  'afp.com': { name: 'AFP', lean: 'center', type: 'Wire' },

  // PUBLIC BROADCASTING (Center to Center-Left)
  'npr.org': { name: 'NPR', lean: 'center-left', type: 'Public-Trust' },
  'pbs.org': { name: 'PBS', lean: 'center', type: 'Public-Trust' },
  'bbc.com': { name: 'BBC', lean: 'center', type: 'Public-Trust' },
  'bbc.co.uk': { name: 'BBC', lean: 'center', type: 'Public-Trust' },
  'abc.net.au': { name: 'ABC Australia', lean: 'center', type: 'Public-Trust' },
  'cbc.ca': { name: 'CBC', lean: 'center', type: 'Public-Trust' },

  // STATE-FUNDED
  'aljazeera.com': { name: 'Al Jazeera', lean: 'center', type: 'State-Funded' },

  // LEFT
  'cnn.com': { name: 'CNN', lean: 'left', type: 'Corporate' },
  'msnbc.com': { name: 'MSNBC', lean: 'left', type: 'Corporate' },
  'theguardian.com': { name: 'The Guardian', lean: 'left', type: 'International' },
  'propublica.org': { name: 'ProPublica', lean: 'left', type: 'Nonprofit' },
  'theintercept.com': { name: 'The Intercept', lean: 'left', type: 'Nonprofit' },
  'motherjones.com': { name: 'Mother Jones', lean: 'left', type: 'Nonprofit' },
  'newrepublic.com': { name: 'The New Republic', lean: 'left', type: 'Magazine' },
  'jacobin.com': { name: 'Jacobin', lean: 'left', type: 'Magazine' },
  'bostonglobe.com': { name: 'Boston Globe', lean: 'left', type: 'National' },
  'newyorker.com': { name: 'The New Yorker', lean: 'left', type: 'Magazine' },

  // CENTER-LEFT (AllSides "Lean Left")
  'politico.com': { name: 'Politico', lean: 'center-left', type: 'Analysis' },  // AllSides Dec 2024
  'nytimes.com': { name: 'New York Times', lean: 'center-left', type: 'National' },
  'washingtonpost.com': { name: 'Washington Post', lean: 'center-left', type: 'National' },
  'theatlantic.com': { name: 'The Atlantic', lean: 'center-left', type: 'Magazine' },
  'vox.com': { name: 'Vox', lean: 'center-left', type: 'Corporate' },
  'nbcnews.com': { name: 'NBC News', lean: 'center-left', type: 'Corporate' },
  'abcnews.go.com': { name: 'ABC News', lean: 'center-left', type: 'Corporate' },  // AllSides Dec 2024
  'cbsnews.com': { name: 'CBS News', lean: 'center-left', type: 'Corporate' },  // AllSides Dec 2024
  'usatoday.com': { name: 'USA Today', lean: 'center-left', type: 'National' },  // AllSides Dec 2024
  'bloomberg.com': { name: 'Bloomberg', lean: 'center-left', type: 'Specialized' },  // AllSides Dec 2024
  'time.com': { name: 'Time', lean: 'center-left', type: 'Magazine' },  // AllSides Dec 2024
  'semafor.com': { name: 'Semafor', lean: 'center-left', type: 'Corporate' },

  // CENTER
  'axios.com': { name: 'Axios', lean: 'center', type: 'National' },
  'thehill.com': { name: 'The Hill', lean: 'center', type: 'Analysis' },
  'foreignpolicy.com': { name: 'Foreign Policy', lean: 'center', type: 'Analysis' },
  'foreignaffairs.com': { name: 'Foreign Affairs', lean: 'center', type: 'Analysis' },
  'straightarrownews.com': { name: 'Straight Arrow News', lean: 'center', type: 'Corporate' },
  'reason.com': { name: 'Reason', lean: 'center', type: 'Nonprofit' },
  '1440.com': { name: '1440 Newsletter', lean: 'center', type: 'Corporate' },
  'readtangle.com': { name: 'Tangle', lean: 'center', type: 'Corporate' },

  // CENTER-RIGHT (AllSides "Lean Right")
  'wsj.com': { name: 'Wall Street Journal', lean: 'center-right', type: 'Specialized' },
  'thedispatch.com': { name: 'The Dispatch', lean: 'center-right', type: 'Magazine' },
  'thebulwark.com': { name: 'The Bulwark', lean: 'center-right', type: 'Magazine' },
  'telegraph.co.uk': { name: 'The Telegraph', lean: 'center-right', type: 'International' },
  'economist.com': { name: 'The Economist', lean: 'center-right', type: 'Magazine' },
  'ft.com': { name: 'Financial Times', lean: 'center-right', type: 'Specialized' },
  'cnbc.com': { name: 'CNBC', lean: 'center-right', type: 'Specialized' },
  'washingtontimes.com': { name: 'Washington Times', lean: 'center-right', type: 'Corporate' },
  'washingtonexaminer.com': { name: 'Washington Examiner', lean: 'center-right', type: 'Corporate' },
  'hotair.com': { name: 'Hot Air', lean: 'center-right', type: 'Corporate' },
  'thefp.com': { name: 'The Free Press', lean: 'center-right', type: 'Corporate' },
  'justthenews.com': { name: 'Just the News', lean: 'center-right', type: 'Corporate' },
  'zerohedge.com': { name: 'ZeroHedge', lean: 'center-right', type: 'Corporate' },

  // RIGHT (AllSides/Ad Fontes verified)
  'foxnews.com': { name: 'Fox News', lean: 'right', type: 'Corporate' },
  'nypost.com': { name: 'New York Post', lean: 'right', type: 'National' },
  'dailywire.com': { name: 'Daily Wire', lean: 'right', type: 'Corporate' },
  'newsmax.com': { name: 'Newsmax', lean: 'right', type: 'Corporate' },
  'breitbart.com': { name: 'Breitbart', lean: 'right', type: 'Corporate' },
  'nationalreview.com': { name: 'National Review', lean: 'right', type: 'Magazine' },
  'dailycaller.com': { name: 'Daily Caller', lean: 'right', type: 'Corporate' },
  'theblaze.com': { name: 'The Blaze', lean: 'right', type: 'Corporate' },
  'freebeacon.com': { name: 'Washington Free Beacon', lean: 'right', type: 'Nonprofit' },
  'townhall.com': { name: 'Townhall', lean: 'right', type: 'Corporate' },
  'redstate.com': { name: 'RedState', lean: 'right', type: 'Corporate' },
  'thefederalist.com': { name: 'The Federalist', lean: 'right', type: 'Corporate' },
  'spectator.org': { name: 'American Spectator', lean: 'right', type: 'Magazine' },
  'thenewamerican.com': { name: 'The New American', lean: 'right', type: 'Magazine' },
  'city-journal.org': { name: 'City Journal', lean: 'right', type: 'Magazine' },
  'oann.com': { name: 'OANN', lean: 'right', type: 'Corporate' },
  'epochtimes.com': { name: 'The Epoch Times', lean: 'right', type: 'Corporate' },
  'pjmedia.com': { name: 'PJ Media', lean: 'right', type: 'Corporate' },
  'thepostmillennial.com': { name: 'The Post Millennial', lean: 'right', type: 'Corporate' },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize a domain for lookup (removes www., m., amp. prefixes)
 */
function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/^m\./, '')
    .replace(/^amp\./, '');
}

/**
 * Get source entry from URL or domain
 */
export function getSourceFromUrl(urlOrDomain: string): SourceEntry | null {
  let domain: string;

  try {
    // If it looks like a URL, extract the hostname
    if (urlOrDomain.includes('://')) {
      domain = new URL(urlOrDomain).hostname;
    } else {
      domain = urlOrDomain;
    }
  } catch {
    domain = urlOrDomain;
  }

  const normalized = normalizeDomain(domain);

  // Exact match
  if (SOURCE_DATABASE[normalized]) {
    return SOURCE_DATABASE[normalized];
  }

  // Handle special subdomains (e.g., abcnews.go.com)
  if (normalized.includes('abcnews')) {
    return SOURCE_DATABASE['abcnews.go.com'];
  }

  // Partial match for major domains
  for (const [key, entry] of Object.entries(SOURCE_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return entry;
    }
  }

  return null;
}

/**
 * Get political lean for a domain (defaults to 'center' if unknown)
 */
export function getPoliticalLean(urlOrDomain: string): PoliticalLean {
  const source = getSourceFromUrl(urlOrDomain);
  return source?.lean ?? 'center';
}

/**
 * Get display name for a domain
 */
export function getSourceName(urlOrDomain: string): string | null {
  const source = getSourceFromUrl(urlOrDomain);
  return source?.name ?? null;
}

/**
 * Get source type for a domain
 */
export function getSourceType(urlOrDomain: string): SourceType | null {
  const source = getSourceFromUrl(urlOrDomain);
  return source?.type ?? null;
}

// =============================================================================
// UI CONSTANTS - Colors and labels for consistent rendering
// =============================================================================

export const LEAN_COLORS: Record<PoliticalLean, { bar: string; headerBg: string; bg: string; border: string; text: string }> = {
  'left': { bar: 'bg-blue-600', headerBg: 'bg-blue-600', bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-800' },
  'center-left': { bar: 'bg-cyan-500', headerBg: 'bg-cyan-500', bg: 'bg-cyan-100', border: 'border-cyan-200', text: 'text-cyan-800' },
  'center': { bar: 'bg-purple-500', headerBg: 'bg-purple-500', bg: 'bg-purple-100', border: 'border-purple-200', text: 'text-purple-800' },
  'center-right': { bar: 'bg-orange-500', headerBg: 'bg-orange-500', bg: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-800' },
  'right': { bar: 'bg-red-600', headerBg: 'bg-red-600', bg: 'bg-red-100', border: 'border-red-200', text: 'text-red-800' },
};

export const LEAN_LABELS: Record<PoliticalLean, string> = {
  'left': 'Left',
  'center-left': 'Center-Left',
  'center': 'Center',
  'center-right': 'Center-Right',
  'right': 'Right',
};

// =============================================================================
// GROUPED DATA - For Sources page display
// =============================================================================

export function getSourcesByLean(): Record<PoliticalLean, Array<{ name: string; domain: string; type: SourceType }>> {
  const grouped: Record<PoliticalLean, Array<{ name: string; domain: string; type: SourceType }>> = {
    'left': [],
    'center-left': [],
    'center': [],
    'center-right': [],
    'right': [],
  };

  for (const [domain, entry] of Object.entries(SOURCE_DATABASE)) {
    grouped[entry.lean].push({
      name: entry.name,
      domain,
      type: entry.type,
    });
  }

  return grouped;
}
