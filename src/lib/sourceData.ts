// MirrorSource Source Database
// Political lean ratings verified against AllSides Media Bias Ratings (December 2024)
// Ownership types: nonprofit, public, family, billionaire, corporate, government, cooperative

export type PoliticalLean = 'left' | 'center-left' | 'center' | 'center-right' | 'right';
export type OwnershipType = 'nonprofit' | 'public' | 'family' | 'billionaire' | 'corporate' | 'government' | 'cooperative';

export interface Source {
  domain: string;
  name: string;
  lean: PoliticalLean;
  type: OwnershipType;
}

export const SOURCES: Source[] = [
  // ============================================
  // LEFT - AllSides "Left" rating
  // ============================================
  { domain: 'msnbc.com', name: 'MSNBC', lean: 'left', type: 'public' },           // Warner Bros Discovery (spinning off)
  { domain: 'vox.com', name: 'Vox', lean: 'left', type: 'corporate' },            // Vox Media
  { domain: 'huffpost.com', name: 'HuffPost', lean: 'left', type: 'corporate' },  // BuzzFeed Inc
  { domain: 'motherjones.com', name: 'Mother Jones', lean: 'left', type: 'nonprofit' },
  { domain: 'thenation.com', name: 'The Nation', lean: 'left', type: 'nonprofit' },
  { domain: 'jacobin.com', name: 'Jacobin', lean: 'left', type: 'corporate' },
  { domain: 'dailykos.com', name: 'Daily Kos', lean: 'left', type: 'corporate' },
  { domain: 'commondreams.org', name: 'Common Dreams', lean: 'left', type: 'nonprofit' },
  { domain: 'democracynow.org', name: 'Democracy Now!', lean: 'left', type: 'nonprofit' },
  { domain: 'theintercept.com', name: 'The Intercept', lean: 'left', type: 'nonprofit' }, // First Look Media (Omidyar)
  { domain: 'slate.com', name: 'Slate', lean: 'left', type: 'corporate' },        // Graham Holdings
  { domain: 'salon.com', name: 'Salon', lean: 'left', type: 'corporate' },
  { domain: 'thedailybeast.com', name: 'The Daily Beast', lean: 'left', type: 'billionaire' }, // Barry Diller/IAC
  { domain: 'theatlantic.com', name: 'The Atlantic', lean: 'left', type: 'billionaire' },  // Laurene Powell Jobs
  { domain: 'newyorker.com', name: 'The New Yorker', lean: 'left', type: 'family' },      // Condé Nast/Newhouse
  { domain: 'apnews.com', name: 'Associated Press', lean: 'left', type: 'cooperative' },  // Member cooperative - UPDATED per AllSides

  // ============================================
  // CENTER-LEFT - AllSides "Lean Left" rating
  // ============================================
  { domain: 'nytimes.com', name: 'The New York Times', lean: 'center-left', type: 'family' },  // Sulzberger family control
  { domain: 'washingtonpost.com', name: 'The Washington Post', lean: 'center-left', type: 'billionaire' }, // Jeff Bezos
  { domain: 'cnn.com', name: 'CNN', lean: 'center-left', type: 'public' },        // Warner Bros Discovery
  { domain: 'npr.org', name: 'NPR', lean: 'center-left', type: 'nonprofit' },     // UPDATED per AllSides
  { domain: 'pbs.org', name: 'PBS', lean: 'center-left', type: 'nonprofit' },
  { domain: 'nbcnews.com', name: 'NBC News', lean: 'center-left', type: 'public' },  // Comcast
  { domain: 'abcnews.go.com', name: 'ABC News', lean: 'center-left', type: 'public' }, // Disney - UPDATED per AllSides
  { domain: 'cbsnews.com', name: 'CBS News', lean: 'center-left', type: 'public' },   // Paramount - UPDATED per AllSides
  { domain: 'politico.com', name: 'Politico', lean: 'center-left', type: 'corporate' }, // Axel Springer - UPDATED per AllSides
  { domain: 'bloomberg.com', name: 'Bloomberg', lean: 'center-left', type: 'billionaire' }, // Michael Bloomberg - UPDATED per AllSides
  { domain: 'usatoday.com', name: 'USA Today', lean: 'center-left', type: 'public' },   // Gannett - UPDATED per AllSides
  { domain: 'time.com', name: 'Time', lean: 'center-left', type: 'billionaire' },       // Marc Benioff - UPDATED per AllSides
  { domain: 'propublica.org', name: 'ProPublica', lean: 'center-left', type: 'nonprofit' },
  { domain: 'theguardian.com', name: 'The Guardian', lean: 'center-left', type: 'nonprofit' }, // Scott Trust
  { domain: 'latimes.com', name: 'Los Angeles Times', lean: 'center-left', type: 'billionaire' }, // Patrick Soon-Shiong
  { domain: 'axios.com', name: 'Axios', lean: 'center-left', type: 'corporate' },   // Cox Enterprises
  { domain: 'semafor.com', name: 'Semafor', lean: 'center-left', type: 'corporate' }, // NEW per AllSides
  { domain: 'buzzfeednews.com', name: 'BuzzFeed News', lean: 'center-left', type: 'public' },

  // ============================================
  // CENTER - AllSides "Center" rating
  // ============================================
  { domain: 'reuters.com', name: 'Reuters', lean: 'center', type: 'public' },     // Thomson Reuters
  { domain: 'bbc.com', name: 'BBC', lean: 'center', type: 'government' },         // UK public broadcaster
  { domain: 'bbc.co.uk', name: 'BBC', lean: 'center', type: 'government' },
  { domain: 'thehill.com', name: 'The Hill', lean: 'center', type: 'corporate' }, // Nexstar Media
  { domain: 'wsj.com', name: 'Wall Street Journal', lean: 'center', type: 'family' }, // News Corp/Murdoch (News section)
  { domain: 'cnbc.com', name: 'CNBC', lean: 'center', type: 'public' },           // Comcast
  { domain: 'newsweek.com', name: 'Newsweek', lean: 'center', type: 'corporate' },
  { domain: 'csmonitor.com', name: 'Christian Science Monitor', lean: 'center', type: 'nonprofit' },
  { domain: 'straightarrownews.com', name: 'Straight Arrow News', lean: 'center', type: 'corporate' }, // NEW - AllSides Certified Balanced
  { domain: 'reason.com', name: 'Reason', lean: 'center', type: 'nonprofit' },    // Reason Foundation - UPDATED per AllSides (was Lean Right)
  { domain: '1440.com', name: '1440 Newsletter', lean: 'center', type: 'corporate' }, // NEW per AllSides
  { domain: 'readtangle.com', name: 'Tangle', lean: 'center', type: 'corporate' },    // NEW per AllSides
  { domain: 'allsides.com', name: 'AllSides', lean: 'center', type: 'corporate' },

  // ============================================
  // CENTER-RIGHT - AllSides "Lean Right" rating
  // ============================================
  { domain: 'washingtontimes.com', name: 'Washington Times', lean: 'center-right', type: 'corporate' }, // Operations Holdings
  { domain: 'washingtonexaminer.com', name: 'Washington Examiner', lean: 'center-right', type: 'billionaire' }, // Philip Anschutz
  { domain: 'nypost.com', name: 'New York Post', lean: 'center-right', type: 'family' },   // News Corp/Murdoch
  { domain: 'nationalreview.com', name: 'National Review', lean: 'center-right', type: 'nonprofit' }, // News section
  { domain: 'hotair.com', name: 'Hot Air', lean: 'center-right', type: 'corporate' },      // Salem Media
  { domain: 'freebeacon.com', name: 'Washington Free Beacon', lean: 'center-right', type: 'nonprofit' },
  { domain: 'thefp.com', name: 'The Free Press', lean: 'center-right', type: 'corporate' }, // Bari Weiss - NEW per AllSides
  { domain: 'justthenews.com', name: 'Just the News', lean: 'center-right', type: 'corporate' }, // NEW per AllSides
  { domain: 'zerohedge.com', name: 'ZeroHedge', lean: 'center-right', type: 'corporate' }, // NEW per AllSides
  { domain: 'city-journal.org', name: 'City Journal', lean: 'center-right', type: 'nonprofit' }, // Manhattan Institute

  // ============================================
  // RIGHT - AllSides "Right" rating
  // ============================================
  { domain: 'foxnews.com', name: 'Fox News', lean: 'right', type: 'family' },     // Fox Corp/Murdoch
  { domain: 'breitbart.com', name: 'Breitbart', lean: 'right', type: 'corporate' },
  { domain: 'dailywire.com', name: 'Daily Wire', lean: 'right', type: 'corporate' },   // Jeremy Boreing, Ben Shapiro
  { domain: 'newsmax.com', name: 'Newsmax', lean: 'right', type: 'corporate' },
  { domain: 'oann.com', name: 'OANN', lean: 'right', type: 'family' },            // Herring Networks
  { domain: 'thefederalist.com', name: 'The Federalist', lean: 'right', type: 'corporate' }, // FDRLST Media
  { domain: 'dailycaller.com', name: 'Daily Caller', lean: 'right', type: 'corporate' },
  { domain: 'townhall.com', name: 'Townhall', lean: 'right', type: 'corporate' }, // Salem Media
  { domain: 'redstate.com', name: 'RedState', lean: 'right', type: 'corporate' }, // Salem Media
  { domain: 'theblaze.com', name: 'The Blaze', lean: 'right', type: 'corporate' }, // Blaze Media
  { domain: 'epochtimes.com', name: 'The Epoch Times', lean: 'right', type: 'nonprofit' }, // Epoch Media Group
  { domain: 'thenewamerican.com', name: 'The New American', lean: 'right', type: 'nonprofit' }, // John Birch Society
  { domain: 'thepostmillennial.com', name: 'The Post Millennial', lean: 'right', type: 'corporate' }, // NEW per AllSides

  // ============================================
  // WIRE SERVICES & INTERNATIONAL
  // ============================================
  { domain: 'afp.com', name: 'AFP', lean: 'center', type: 'government' },         // French news agency

  // ============================================
  // STATE-FUNDED (for transparency)
  // ============================================
  { domain: 'rt.com', name: 'RT', lean: 'right', type: 'government' },            // Russian state media
  { domain: 'aljazeera.com', name: 'Al Jazeera', lean: 'center-left', type: 'government' }, // Qatar
];

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
    .replace(/^amp\./, '')
    .replace(/\/$/, '');
}

/**
 * Get source info from URL or domain
 */
export function getSourceInfo(urlOrDomain: string): Source | undefined {
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
  const exactMatch = SOURCES.find(s => s.domain === normalized);
  if (exactMatch) return exactMatch;

  // Handle special subdomains (e.g., abcnews.go.com)
  if (normalized.includes('abcnews')) {
    return SOURCES.find(s => s.domain === 'abcnews.go.com');
  }

  // Partial match for major domains
  return SOURCES.find(s => normalized.includes(s.domain) || s.domain.includes(normalized));
}

/**
 * Get political lean for a domain (defaults to 'center' if unknown)
 */
export function getPoliticalLean(urlOrDomain: string): PoliticalLean {
  const source = getSourceInfo(urlOrDomain);
  const lean = source?.lean ?? 'center';
  console.log('[getPoliticalLean]', { input: urlOrDomain, normalized: urlOrDomain?.toLowerCase(), source: source?.domain, lean });
  return lean;
}

/**
 * Get display name for a domain
 */
export function getSourceName(urlOrDomain: string): string | null {
  const source = getSourceInfo(urlOrDomain);
  return source?.name ?? null;
}

/**
 * Get ownership type for a domain
 */
export function getOwnershipType(urlOrDomain: string): OwnershipType | null {
  const source = getSourceInfo(urlOrDomain);
  return source?.type ?? null;
}

/**
 * Get ownership type label for display
 */
export function getOwnershipLabel(type: OwnershipType): string {
  const labels: Record<OwnershipType, string> = {
    nonprofit: 'Nonprofit',
    public: 'Public Company',
    family: 'Family-Controlled',
    billionaire: 'Billionaire-Owned',
    corporate: 'Corporate',
    government: 'State-Funded',
    cooperative: 'Member Cooperative',
  };
  return labels[type];
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

export function getSourcesByLean(): Record<PoliticalLean, Array<{ name: string; domain: string; type: OwnershipType }>> {
  const grouped: Record<PoliticalLean, Array<{ name: string; domain: string; type: OwnershipType }>> = {
    'left': [],
    'center-left': [],
    'center': [],
    'center-right': [],
    'right': [],
  };

  for (const source of SOURCES) {
    grouped[source.lean].push({
      name: source.name,
      domain: source.domain,
      type: source.type,
    });
  }

  return grouped;
}

// =============================================================================
// DOMAIN LISTS - For Gap Fill targeting
// =============================================================================

export const RIGHT_LEANING_DOMAINS = SOURCES
  .filter(s => s.lean === 'right' || s.lean === 'center-right')
  .map(s => s.domain);

export const LEFT_LEANING_DOMAINS = SOURCES
  .filter(s => s.lean === 'left' || s.lean === 'center-left')
  .map(s => s.domain);

export const CENTER_DOMAINS = SOURCES
  .filter(s => s.lean === 'center')
  .map(s => s.domain);
