import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage, COOKIE_OPTIONS } from "@/lib/rate-limiter";
import { getPoliticalLean } from "@/lib/sourceData";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// =============================================================================
// SIMPLE IN-MEMORY CACHE (1 hour TTL, resets on cold start)
// =============================================================================
const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCachedResult(query: string): any | null {
  const cached = searchCache.get(query.toLowerCase());
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    searchCache.delete(query.toLowerCase());
    console.log('[Cache] Expired:', query);
    return null;
  }

  console.log('[Cache] HIT:', query);
  return cached.data;
}

function setCachedResult(query: string, data: any): void {
  // Limit cache size to prevent memory issues
  if (searchCache.size > 500) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }

  searchCache.set(query.toLowerCase(), { data, timestamp: Date.now() });
  console.log('[Cache] SET:', query);
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// --- Error Types ---
type ErrorType = 'INVALID_URL' | 'INVALID_KEYWORDS' | 'NETWORK_ERROR' | 'TIMEOUT' | 'RATE_LIMITED' | 'API_ERROR' | 'NO_RESULTS';

interface AppError {
  type: ErrorType;
  userMessage: string;
  statusCode: number;
  retryable: boolean;
}

function createError(type: ErrorType, details?: string): AppError {
  const errors: Record<ErrorType, Omit<AppError, 'type'>> = {
    INVALID_URL: {
      userMessage: 'Please enter a valid news article URL (must start with http:// or https://)',
      statusCode: 400,
      retryable: false,
    },
    INVALID_KEYWORDS: {
      userMessage: 'Please enter some keywords to search for.',
      statusCode: 400,
      retryable: false,
    },
    NETWORK_ERROR: {
      userMessage: 'Unable to connect. Please check your internet connection and try again.',
      statusCode: 503,
      retryable: true,
    },
    TIMEOUT: {
      userMessage: 'The search took too long. Please try again.',
      statusCode: 504,
      retryable: true,
    },
    RATE_LIMITED: {
      userMessage: details || 'You\'ve reached your daily limit. Try again tomorrow!',
      statusCode: 429,
      retryable: false,
    },
    API_ERROR: {
      userMessage: 'Search failed. Please try again.',
      statusCode: 500,
      retryable: true,
    },
    NO_RESULTS: {
      userMessage: 'No coverage found on trusted news sources. Try different keywords.',
      statusCode: 200,
      retryable: true,
    },
  };
  
  return { type, ...errors[type] };
}

// --- Paywall Detection ---
const PAYWALLED_DOMAINS = new Set([
  'wsj.com', 'nytimes.com', 'washingtonpost.com', 'ft.com', 
  'economist.com', 'bloomberg.com', 'theatlantic.com', 'newyorker.com',
  'barrons.com', 'thetimes.co.uk',
]);

function isPaywalledSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    return Array.from(PAYWALLED_DOMAINS).some(domain => hostname.includes(domain));
  } catch { return false; }
}

// --- Gap Fill Domains for Political Balance ---
// Used for targeted searches when initial results lack political diversity
const RIGHT_LEANING_DOMAINS = [
  'foxnews.com',
  'nypost.com',
  'dailywire.com',
  'nationalreview.com',
  'breitbart.com',
  'washingtontimes.com',
  'washingtonexaminer.com',
  'thefederalist.com',
  'dailycaller.com',
  'newsmax.com',
  'townhall.com',
  'hotair.com',
  'redstate.com',
  'freebeacon.com',
];

const LEFT_LEANING_DOMAINS = [
  'msnbc.com',
  'huffpost.com',
  'vox.com',
  'slate.com',
  'motherjones.com',
  'thenation.com',
  'jacobin.com',
  'dailykos.com',
  'commondreams.org',
  'democracynow.org',
];

// =============================================================================
// SOURCE CLASSIFICATION WITH TRANSPARENCY DATA
// =============================================================================

type SourceType = 'wire' | 'public' | 'public-trust' | 'corporate' | 'state' | 'state-funded' | 'nonprofit' | 'analysis' | 'local' | 'national' | 'international' | 'magazine' | 'specialized' | 'reference' | 'syndication' | 'platform';

type OwnershipType = 'private' | 'public_traded' | 'nonprofit' | 'public_media' | 'state_owned' | 'cooperative' | 'trust';

interface OwnershipInfo {
  owner: string;
  parent?: string;
  type: OwnershipType;
  note?: string;
}

interface FundingInfo {
  model: string;
  note?: string;
}

type PoliticalLean = 'left' | 'center-left' | 'center' | 'center-right' | 'right';

interface SourceInfo {
  displayName: string;
  type: SourceType;
  countryCode: string;
  ownership?: OwnershipInfo;
  funding?: FundingInfo;
  lean?: PoliticalLean;
}

// Complete source database with transparency data
const sources: Record<string, SourceInfo> = {
  // ===========================================================================
  // SYNDICATION
  // ===========================================================================
  'finance.yahoo.com': {
    displayName: 'YAHOO FINANCE',
    type: 'syndication',
    countryCode: 'US',
    ownership: { owner: 'Yahoo', parent: 'Apollo Global Management', type: 'private', note: 'Apollo acquired Yahoo from Verizon for $5B in 2021' },
    funding: { model: 'Advertising & Yahoo Finance Plus subscriptions' },
  },
  'news.yahoo.com': {
    displayName: 'YAHOO NEWS',
    type: 'syndication',
    countryCode: 'US',
    ownership: { owner: 'Yahoo', parent: 'Apollo Global Management', type: 'private', note: 'Aggregates content from partner publications' },
    funding: { model: 'Advertising' },
  },
  'yahoo.com': {
    displayName: 'YAHOO',
    type: 'syndication',
    countryCode: 'US',
    ownership: { owner: 'Yahoo', parent: 'Apollo Global Management', type: 'private', note: 'Apollo acquired Yahoo from Verizon for $5B in 2021' },
    funding: { model: 'Advertising' },
  },
  'msn.com': {
    displayName: 'MSN',
    type: 'syndication',
    countryCode: 'US',
    ownership: { owner: 'Microsoft Corporation', type: 'public_traded', note: 'NASDAQ (MSFT). News aggregation portal' },
    funding: { model: 'Advertising' },
  },

  // ===========================================================================
  // WIRE SERVICES
  // ===========================================================================
  'apnews.com': {
    displayName: 'AP NEWS',
    type: 'wire',
    countryCode: 'US',
    ownership: { owner: 'Associated Press', type: 'cooperative', note: 'Non-profit cooperative owned by ~1,300 member newspapers and broadcasters' },
    funding: { model: 'Member fees & content licensing to media outlets worldwide' },
    lean: 'center',
  },
  'reuters.com': {
    displayName: 'REUTERS',
    type: 'wire',
    countryCode: 'UK',
    ownership: { owner: 'Thomson Reuters Corporation', type: 'public_traded', note: 'NYSE (TRI) and TSX. Thomson family holds ~65% voting control' },
    funding: { model: 'Financial data terminals, news licensing & professional services' },
    lean: 'center',
  },
  'afp.com': {
    displayName: 'AFP',
    type: 'wire',
    countryCode: 'FR',
    ownership: { owner: 'Agence France-Presse', type: 'public_media', note: 'French state provides ~40% funding; editorial independence legally protected since 1957' },
    funding: { model: 'French government contracts, news licensing & subscriptions' },
  },

  // ===========================================================================
  // PUBLIC BROADCASTING
  // ===========================================================================
  'npr.org': {
    displayName: 'NPR',
    type: 'public-trust',
    countryCode: 'US',
    ownership: { owner: 'National Public Radio, Inc.', type: 'nonprofit', note: '501(c)(3) non-profit media organization founded 1970' },
    funding: { model: 'Member station fees, corporate sponsors, foundations & individual donors', note: 'Federal funding via CPB is <1% of total budget' },
    lean: 'center-left',
  },
  'pbs.org': {
    displayName: 'PBS',
    type: 'public-trust',
    countryCode: 'US',
    ownership: { owner: 'Public Broadcasting Service', type: 'nonprofit', note: 'Non-profit public broadcaster; member organization of 350+ local stations' },
    funding: { model: 'Member stations, corporate underwriting, foundations & viewer donations' },
    lean: 'center',
  },
  'opb.org': {
    displayName: 'OPB',
    type: 'public',
    countryCode: 'US',
    ownership: { owner: 'Oregon Public Broadcasting', type: 'nonprofit', note: 'Regional public media organization serving Oregon and SW Washington' },
    funding: { model: 'Member donations, corporate sponsors & CPB grants' },
  },
  'bbc.com': {
    displayName: 'BBC',
    type: 'public-trust',
    countryCode: 'UK',
    ownership: { owner: 'British Broadcasting Corporation', type: 'public_media', note: 'UK public corporation established by Royal Charter; governed by BBC Board' },
    funding: { model: 'UK TV license fee (£159/year) & BBC Studios commercial revenue' },
    lean: 'center',
  },
  'bbc.co.uk': {
    displayName: 'BBC',
    type: 'public',
    countryCode: 'UK',
    ownership: { owner: 'British Broadcasting Corporation', type: 'public_media', note: 'UK public corporation established by Royal Charter' },
    funding: { model: 'UK TV license fee (£159/year) & BBC Studios commercial revenue' },
  },
  'cbc.ca': {
    displayName: 'CBC',
    type: 'public',
    countryCode: 'CA',
    ownership: { owner: 'Canadian Broadcasting Corporation', type: 'public_media', note: 'Canadian Crown corporation established 1936; reports to Parliament' },
    funding: { model: 'Canadian federal government appropriation (~$1.2B/year) & advertising' },
  },
  'abc.net.au': {
    displayName: 'ABC AUSTRALIA',
    type: 'public',
    countryCode: 'AU',
    ownership: { owner: 'Australian Broadcasting Corporation', type: 'public_media', note: 'Australian federal government statutory authority; independent board' },
    funding: { model: 'Australian federal government funding (no advertising on domestic services)' },
  },
  'sbs.com.au': {
    displayName: 'SBS',
    type: 'public',
    countryCode: 'AU',
    ownership: { owner: 'Special Broadcasting Service', type: 'public_media', note: 'Australian multicultural public broadcaster established 1978' },
    funding: { model: 'Australian government funding & limited advertising' },
  },
  'channel4.com': {
    displayName: 'CHANNEL 4',
    type: 'public',
    countryCode: 'UK',
    ownership: { owner: 'Channel Four Television Corporation', type: 'public_media', note: 'UK publicly-owned but commercially-funded; cannot be sold for profit' },
    funding: { model: 'Advertising revenue (self-funded, no license fee)' },
  },
  'rnz.co.nz': {
    displayName: 'RNZ',
    type: 'public',
    countryCode: 'NZ',
    ownership: { owner: 'Radio New Zealand', type: 'public_media', note: 'New Zealand public broadcaster; Crown entity since 1995' },
    funding: { model: 'New Zealand government funding (no advertising)' },
  },
  'rte.ie': {
    displayName: 'RTE',
    type: 'public',
    countryCode: 'IE',
    ownership: { owner: 'Raidió Teilifís Éireann', type: 'public_media', note: 'Ireland\'s national public broadcaster; statutory corporation' },
    funding: { model: 'TV license fee & commercial advertising' },
  },

  // ===========================================================================
  // INTERNATIONAL
  // ===========================================================================
  'aljazeera.com': {
    displayName: 'Al Jazeera',
    type: 'state-funded',
    countryCode: 'QA',
    ownership: { owner: 'Al Jazeera Media Network', parent: 'Government of Qatar', type: 'state_owned', note: 'Funded by Qatar government' },
    funding: { model: 'State funding', note: 'Qatar state-backed international news' },
    lean: 'center',
  },
  'theguardian.com': {
    displayName: 'THE GUARDIAN',
    type: 'international',
    countryCode: 'UK',
    ownership: { owner: 'Guardian Media Group', parent: 'Scott Trust Limited', type: 'trust', note: 'Trust structure (since 1936) ensures editorial independence in perpetuity' },
    funding: { model: 'Reader contributions, advertising, events & Guardian Foundation grants', note: 'No paywall; relies on voluntary reader support (~1M+ paying supporters)' },
    lean: 'left',
  },
  'thehindu.com': {
    displayName: 'THE HINDU',
    type: 'international',
    countryCode: 'IN',
    ownership: { owner: 'The Hindu Group', parent: 'Kasturi & Sons Ltd.', type: 'private', note: 'Family-owned since 1878; based in Chennai' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'dw.com': {
    displayName: 'DW',
    type: 'international',
    countryCode: 'DE',
    ownership: { owner: 'Deutsche Welle', type: 'public_media', note: 'German public international broadcaster; legally independent from government' },
    funding: { model: 'German federal tax revenue (100% publicly funded)' },
  },
  'france24.com': {
    displayName: 'FRANCE 24',
    type: 'international',
    countryCode: 'FR',
    ownership: { owner: 'France Médias Monde', type: 'public_media', note: 'French international public broadcaster; editorial independence guaranteed by law' },
    funding: { model: 'French government funding via license fee revenue' },
  },
  'scmp.com': {
    displayName: 'SCMP',
    type: 'international',
    countryCode: 'HK',
    ownership: { owner: 'Alibaba Group', type: 'public_traded', note: 'Acquired by Alibaba (Jack Ma) in 2016; Alibaba trades on NYSE (BABA)' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'timesofisrael.com': {
    displayName: 'TIMES OF ISRAEL',
    type: 'international',
    countryCode: 'IL',
    ownership: { owner: 'Times of Israel Ltd.', type: 'private', note: 'Founded 2012 by David Horovitz; backed by Seth Klarman (Baupost Group)' },
    funding: { model: 'Advertising, memberships & sponsored content' },
  },
  'jpost.com': {
    displayName: 'JERUSALEM POST',
    type: 'international',
    countryCode: 'IL',
    ownership: { owner: 'Jerusalem Post Group', parent: 'Eli Azur (controlling stake)', type: 'private', note: 'Israeli media entrepreneur Eli Azur acquired majority stake in 2019' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'ynetnews.com': {
    displayName: 'YNET NEWS',
    type: 'international',
    countryCode: 'IL',
    ownership: { owner: 'Yedioth Ahronoth Group', type: 'private', note: 'Owned by Moses family; largest newspaper group in Israel' },
    funding: { model: 'Advertising (free access model)' },
  },
  'haaretz.com': {
    displayName: 'HAARETZ',
    type: 'international',
    countryCode: 'IL',
    ownership: { owner: 'Haaretz Group', type: 'private', note: 'Schocken family holds majority; M. DuMont Schauberg (Germany) owns 25%' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'i24news.tv': {
    displayName: 'I24 NEWS',
    type: 'international',
    countryCode: 'IL',
    ownership: { owner: 'i24NEWS', parent: 'Altice Group (Patrick Drahi)', type: 'private', note: 'Founded 2013; owned by telecom billionaire Patrick Drahi' },
    funding: { model: 'Parent company funding & advertising' },
  },
  'thearabdailynews.com': {
    displayName: 'ARAB DAILY NEWS',
    type: 'international',
    countryCode: 'US',
    ownership: { owner: 'Arab Daily News LLC', type: 'private', note: 'US-based Arab American news outlet' },
    funding: { model: 'Advertising & sponsorships' },
  },
  'arabnews.com': {
    displayName: 'ARAB NEWS',
    type: 'international',
    countryCode: 'SA',
    ownership: { owner: 'Saudi Research and Media Group (SRMG)', type: 'private', note: 'SRMG is closely aligned with Saudi government interests' },
    funding: { model: 'Parent company funding & advertising' },
  },
  'middleeasteye.net': {
    displayName: 'MIDDLE EAST EYE',
    type: 'international',
    countryCode: 'UK',
    ownership: { owner: 'Middle East Eye Ltd.', type: 'private', note: 'UK-registered; founded 2014. Funding sources not fully disclosed; Qatar links alleged' },
    funding: { model: 'Not publicly disclosed', note: 'Non-profit structure; funding transparency limited' },
  },
  'straitstimes.com': {
    displayName: 'STRAITS TIMES',
    type: 'international',
    countryCode: 'SG',
    ownership: { owner: 'Singapore Press Holdings', parent: 'SPH Media Trust', type: 'nonprofit', note: 'Restructured 2022; media arm now held by non-profit trust' },
    funding: { model: 'Government funding, subscriptions & advertising' },
  },
  'channelnewsasia.com': {
    displayName: 'CNA',
    type: 'international',
    countryCode: 'SG',
    ownership: { owner: 'Mediacorp', type: 'state_owned', note: 'Mediacorp is wholly owned by Temasek Holdings (Singapore sovereign wealth fund)' },
    funding: { model: 'Singapore government funding & advertising' },
  },
  'japantimes.co.jp': {
    displayName: 'JAPAN TIMES',
    type: 'international',
    countryCode: 'JP',
    ownership: { owner: 'The Japan Times, Ltd.', parent: 'News2u Holdings (Ogasawara family)', type: 'private', note: 'Oldest English-language newspaper in Japan (founded 1897)' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'koreaherald.com': {
    displayName: 'KOREA HERALD',
    type: 'international',
    countryCode: 'KR',
    ownership: { owner: 'Herald Corporation', type: 'private', note: 'Part of Herald Media Group; South Korea\'s largest English daily' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'koreatimes.co.kr': {
    displayName: 'KOREA TIMES',
    type: 'international',
    countryCode: 'KR',
    ownership: { owner: 'Hankook Ilbo', type: 'private', note: 'Owned by Hankook Ilbo media group' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'bangkokpost.com': {
    displayName: 'BANGKOK POST',
    type: 'international',
    countryCode: 'TH',
    ownership: { owner: 'The Post Publishing PCL', type: 'public_traded', note: 'Traded on Stock Exchange of Thailand; established 1946' },
    funding: { model: 'Advertising & subscriptions' },
  },

  // ===========================================================================
  // US CORPORATE BROADCAST
  // ===========================================================================
  'cnn.com': {
    displayName: 'CNN',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Warner Bros. Discovery', type: 'public_traded', note: 'WBD trades on NASDAQ (WBD). Created from WarnerMedia-Discovery merger 2022' },
    funding: { model: 'Advertising, cable carriage fees & CNN+ subscriptions' },
    lean: 'left',
  },
  'foxnews.com': {
    displayName: 'Fox News',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Fox Corporation', parent: 'Fox Corporation', type: 'public_traded', note: 'Owned by Murdoch family via Fox Corp (NASDAQ: FOX)' },
    funding: { model: 'Advertising, cable fees', note: 'Largest US cable news network by viewership' },
    lean: 'right',
  },
  'nbcnews.com': {
    displayName: 'NBC NEWS',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'NBCUniversal News Group', parent: 'Comcast Corporation', type: 'public_traded', note: 'Comcast trades on NASDAQ (CMCSA). Largest cable company in US' },
    funding: { model: 'Advertising, cable fees & Peacock streaming' },
    lean: 'center-left',
  },
  'cbsnews.com': {
    displayName: 'CBS NEWS',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'CBS News and Stations', parent: 'Paramount Global', type: 'public_traded', note: 'Paramount trades NASDAQ (PARA). Shari Redstone controls via National Amusements' },
    funding: { model: 'Advertising, affiliate fees & Paramount+ streaming' },
    lean: 'center-left',
  },
  'abcnews.go.com': {
    displayName: 'ABC NEWS',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'ABC News', parent: 'The Walt Disney Company', type: 'public_traded', note: 'Disney trades on NYSE (DIS). ABC acquired by Disney in 1996' },
    funding: { model: 'Advertising, affiliate fees & Disney+ streaming' },
    lean: 'center-left',
  },
  'msnbc.com': {
    displayName: 'MSNBC',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'NBCUniversal News Group', parent: 'Comcast Corporation', type: 'public_traded', note: 'Comcast trades NASDAQ (CMCSA). Originally NBC-Microsoft joint venture (1996)' },
    funding: { model: 'Advertising & cable carriage fees' },
    lean: 'left',
  },

  // ===========================================================================
  // UK CORPORATE BROADCAST
  // ===========================================================================
  'sky.com': {
    displayName: 'SKY NEWS',
    type: 'corporate',
    countryCode: 'UK',
    ownership: { owner: 'Sky Group', parent: 'Comcast Corporation', type: 'public_traded', note: 'Comcast acquired Sky in 2018 for £30B. Previously Murdoch-controlled' },
    funding: { model: 'Sky subscriptions, advertising & Comcast parent funding' },
  },
  'news.sky.com': {
    displayName: 'SKY NEWS',
    type: 'corporate',
    countryCode: 'UK',
    ownership: { owner: 'Sky Group', parent: 'Comcast Corporation', type: 'public_traded', note: 'Comcast acquired Sky in 2018 for £30B' },
    funding: { model: 'Sky subscriptions, advertising & Comcast parent funding' },
  },
  'itv.com': {
    displayName: 'ITV NEWS',
    type: 'corporate',
    countryCode: 'UK',
    ownership: { owner: 'ITV plc', type: 'public_traded', note: 'Traded on London Stock Exchange (ITV). UK\'s largest commercial broadcaster' },
    funding: { model: 'Advertising revenue (primary) & ITVX streaming' },
  },

  // ===========================================================================
  // CANADIAN CORPORATE BROADCAST
  // ===========================================================================
  'globalnews.ca': {
    displayName: 'GLOBAL NEWS',
    type: 'corporate',
    countryCode: 'CA',
    ownership: { owner: 'Corus Entertainment', type: 'public_traded', note: 'Traded on TSX (CJR.B). Shaw family controls voting shares' },
    funding: { model: 'Advertising & cable carriage fees' },
  },
  'ctvnews.ca': {
    displayName: 'CTV NEWS',
    type: 'corporate',
    countryCode: 'CA',
    ownership: { owner: 'CTV', parent: 'Bell Media (BCE Inc.)', type: 'public_traded', note: 'BCE trades on TSX and NYSE (BCE). Canada\'s largest telecom company' },
    funding: { model: 'Advertising & cable carriage fees' },
  },
  'citynews.ca': {
    displayName: 'CITY NEWS',
    type: 'corporate',
    countryCode: 'CA',
    ownership: { owner: 'Citytv', parent: 'Rogers Communications', type: 'public_traded', note: 'Rogers trades on TSX (RCI.B). Rogers family controls voting shares' },
    funding: { model: 'Advertising & cable carriage fees' },
  },

  // ===========================================================================
  // AUSTRALIAN CORPORATE
  // ===========================================================================
  'news.com.au': {
    displayName: 'NEWS.COM.AU',
    type: 'corporate',
    countryCode: 'AU',
    ownership: { owner: 'News Corp Australia', parent: 'News Corp (Murdoch family)', type: 'public_traded', note: 'News Corp trades NASDAQ (NWSA). Australia\'s largest news website' },
    funding: { model: 'Advertising (free access)' },
  },
  '9news.com.au': {
    displayName: '9 NEWS',
    type: 'corporate',
    countryCode: 'AU',
    ownership: { owner: 'Nine Entertainment', type: 'public_traded', note: 'Traded on ASX (NEC). Merged with Fairfax Media 2018' },
    funding: { model: 'Advertising & streaming (9Now)' },
  },
  '7news.com.au': {
    displayName: '7 NEWS',
    type: 'corporate',
    countryCode: 'AU',
    ownership: { owner: 'Seven West Media', type: 'public_traded', note: 'Traded on ASX (SWM). Kerry Stokes is chairman and major shareholder' },
    funding: { model: 'Advertising & streaming (7plus)' },
  },

  // ===========================================================================
  // US NATIONAL
  // ===========================================================================
  'usatoday.com': {
    displayName: 'USA TODAY',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Gannett Co., Inc.', type: 'public_traded', note: 'NYSE (GCI). Largest US newspaper chain by circulation; merged with GateHouse 2019' },
    funding: { model: 'Advertising, subscriptions & digital marketing services' },
    lean: 'center',
  },
  'axios.com': {
    displayName: 'AXIOS',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Axios Media', parent: 'Cox Enterprises', type: 'private', note: 'Cox Enterprises acquired Axios in 2022 for $525M. Founded by Politico alumni' },
    funding: { model: 'Newsletters, advertising & Axios Pro subscriptions' },
    lean: 'center',
  },
  'bostonglobe.com': {
    displayName: 'Boston Globe',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Boston Globe Media Partners', parent: 'John W. Henry', type: 'private', note: 'Owned by Red Sox owner John Henry' },
    funding: { model: 'Subscriptions, advertising', note: 'Major Northeast newspaper' },
    lean: 'left',
  },

  // ===========================================================================
  // US CONSERVATIVE / RIGHT-LEANING
  // ===========================================================================
  'nypost.com': {
    displayName: 'New York Post',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'News Corp', parent: 'News Corp', type: 'public_traded', note: 'Owned by Rupert Murdoch\'s News Corp (NASDAQ: NWSA)' },
    funding: { model: 'Advertising, subscriptions', note: 'Tabloid format, conservative editorial stance' },
    lean: 'right',
  },
  'washingtonexaminer.com': {
    displayName: 'Washington Examiner',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Clarity Media Group', parent: 'Anschutz Corporation', type: 'private', note: 'Owned by billionaire Philip Anschutz' },
    funding: { model: 'Advertising, subscriptions', note: 'Conservative news and opinion' },
    lean: 'right',
  },
  'washingtontimes.com': {
    displayName: 'Washington Times',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Operations Holdings', parent: 'Unification Church affiliates', type: 'private', note: 'Founded by Sun Myung Moon, now independent' },
    funding: { model: 'Advertising, subscriptions', note: 'Conservative daily newspaper' },
    lean: 'right',
  },
  'dailywire.com': {
    displayName: 'Daily Wire',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Daily Wire LLC', parent: 'Bentkey Ventures', type: 'private', note: 'Co-founded by Ben Shapiro and Jeremy Boreing' },
    funding: { model: 'Subscriptions, advertising', note: 'Conservative media and entertainment company' },
    lean: 'right',
  },
  'newsmax.com': {
    displayName: 'Newsmax',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Newsmax Media Inc', parent: 'Newsmax Media Inc', type: 'private', note: 'Founded by Christopher Ruddy' },
    funding: { model: 'Advertising, cable fees', note: 'Conservative cable and digital news' },
    lean: 'right',
  },
  'breitbart.com': {
    displayName: 'Breitbart',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Breitbart News Network', parent: 'Breitbart News Network', type: 'private', note: 'Founded by Andrew Breitbart, previously chaired by Steve Bannon' },
    funding: { model: 'Advertising', note: 'Right-wing news and opinion' },
    lean: 'right',
  },
  'nationalreview.com': {
    displayName: 'National Review',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'National Review Inc', parent: 'National Review Inc', type: 'nonprofit', note: 'Founded by William F. Buckley Jr. in 1955' },
    funding: { model: 'Subscriptions, donations', note: 'Conservative intellectual magazine' },
    lean: 'right',
  },
  'dailycaller.com': {
    displayName: 'Daily Caller',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Daily Caller Inc', parent: 'Daily Caller Inc', type: 'private', note: 'Co-founded by Tucker Carlson and Neil Patel' },
    funding: { model: 'Advertising', note: 'Conservative news and opinion website' },
    lean: 'right',
  },
  'theblaze.com': {
    displayName: 'The Blaze',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Blaze Media', parent: 'Blaze Media', type: 'private', note: 'Founded by Glenn Beck, merged with CRTV' },
    funding: { model: 'Subscriptions, advertising', note: 'Conservative multimedia network' },
    lean: 'right',
  },
  'freebeacon.com': {
    displayName: 'Washington Free Beacon',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Center for American Freedom', parent: 'Center for American Freedom', type: 'nonprofit', note: 'Conservative nonprofit news organization' },
    funding: { model: 'Donations', note: 'Investigative journalism, conservative perspective' },
    lean: 'right',
  },
  'townhall.com': {
    displayName: 'Townhall',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Salem Communications', parent: 'Salem Communications', type: 'public_traded', note: 'Part of Salem Media Group (NASDAQ: SALM)' },
    funding: { model: 'Advertising', note: 'Conservative news and commentary' },
    lean: 'right',
  },
  'redstate.com': {
    displayName: 'RedState',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Salem Communications', parent: 'Salem Communications', type: 'public_traded', note: 'Part of Salem Media Group (NASDAQ: SALM)' },
    funding: { model: 'Advertising', note: 'Conservative blog and news' },
    lean: 'right',
  },
  'thefederalist.com': {
    displayName: 'The Federalist',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'FDRLST Media', parent: 'FDRLST Media', type: 'private', note: 'Co-founded by Ben Domenech and Sean Davis' },
    funding: { model: 'Advertising, donations', note: 'Conservative online magazine' },
    lean: 'right',
  },
  'spectator.org': {
    displayName: 'The American Spectator',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'American Spectator Foundation', parent: 'American Spectator Foundation', type: 'nonprofit', note: 'Founded in 1924, conservative publication' },
    lean: 'right',
    funding: { model: 'Subscriptions, donations', note: 'Conservative monthly magazine' },
  },

  // ===========================================================================
  // CANADIAN NATIONAL & LOCAL
  // ===========================================================================
  'nationalpost.com': {
    displayName: 'NATIONAL POST',
    type: 'national',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'TSX (PNC.A). US hedge funds (Chatham Asset Management) hold significant debt position' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'theglobeandmail.com': {
    displayName: 'GLOBE AND MAIL',
    type: 'national',
    countryCode: 'CA',
    ownership: { owner: 'Woodbridge Company', type: 'private', note: 'Thomson family investment vehicle owns 85%. Canada\'s newspaper of record' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'globeandmail.com': {
    displayName: 'GLOBE AND MAIL',
    type: 'national',
    countryCode: 'CA',
    ownership: { owner: 'Woodbridge Company', type: 'private', note: 'Thomson family investment vehicle owns 85%' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'torontostar.com': {
    displayName: 'TORONTO STAR',
    type: 'national',
    countryCode: 'CA',
    ownership: { owner: 'Torstar Corporation', parent: 'NordStar Capital', type: 'private', note: 'Acquired by NordStar (Jordan Chicken, Paul Chicken) in 2020 for $52M' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'thestar.com': {
    displayName: 'TORONTO STAR',
    type: 'national',
    countryCode: 'CA',
    ownership: { owner: 'Torstar Corporation', parent: 'NordStar Capital', type: 'private', note: 'Acquired by NordStar in 2020 for $52M' },
    funding: { model: 'Subscriptions & advertising' },
  },
  // Postmedia chain
  'calgaryherald.com': {
    displayName: 'CALGARY HERALD',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'Part of Postmedia chain. TSX (PNC.A)' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'edmontonjournal.com': {
    displayName: 'EDMONTON JOURNAL',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'Part of Postmedia chain' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'vancouversun.com': {
    displayName: 'VANCOUVER SUN',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'Part of Postmedia chain' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'ottawacitizen.com': {
    displayName: 'OTTAWA CITIZEN',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'Part of Postmedia chain' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'montrealgazette.com': {
    displayName: 'MONTREAL GAZETTE',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'Part of Postmedia chain' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'theprovince.com': {
    displayName: 'THE PROVINCE',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'Vancouver tabloid. Part of Postmedia chain' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'windsorstar.com': {
    displayName: 'WINDSOR STAR',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'Part of Postmedia chain' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'leaderpost.com': {
    displayName: 'REGINA LEADER-POST',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'Part of Postmedia chain' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'winnipegfreepress.com': {
    displayName: 'WINNIPEG FREE PRESS',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'FP Canadian Newspapers LP', type: 'private', note: 'One of few major independent papers in Canada. Family-owned since 2001' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'thechronicleherald.ca': {
    displayName: 'CHRONICLE HERALD',
    type: 'local',
    countryCode: 'CA',
    ownership: { owner: 'SaltWire Network', type: 'private', note: 'Largest independently owned newspaper group in Atlantic Canada' },
    funding: { model: 'Subscriptions & advertising' },
  },

  // ===========================================================================
  // UK NATIONAL
  // ===========================================================================
  'telegraph.co.uk': {
    displayName: 'The Telegraph',
    type: 'international',
    countryCode: 'GB',
    ownership: { owner: 'Telegraph Media Group', parent: 'RedBird IMI', type: 'private', note: 'British broadsheet, UAE-backed consortium' },
    funding: { model: 'Subscriptions, advertising', note: 'UK center-right broadsheet' },
    lean: 'center-right',
  },
  'independent.co.uk': {
    displayName: 'THE INDEPENDENT',
    type: 'national',
    countryCode: 'UK',
    ownership: { owner: 'Independent Digital News & Media', parent: 'Sultan Muhammad Abuljadayel', type: 'private', note: 'Saudi investor acquired majority 2023. Digital-only since 2016' },
    funding: { model: 'Advertising (free access)' },
  },
  'thetimes.co.uk': {
    displayName: 'THE TIMES',
    type: 'national',
    countryCode: 'UK',
    ownership: { owner: 'Times Media Limited', parent: 'News UK (News Corp)', type: 'public_traded', note: 'News Corp trades NASDAQ (NWSA). Murdoch family controls voting shares' },
    funding: { model: 'Subscriptions (hard paywall) & advertising' },
  },
  'dailymail.co.uk': {
    displayName: 'DAILY MAIL',
    type: 'national',
    countryCode: 'UK',
    ownership: { owner: 'Daily Mail and General Trust (DMGT)', type: 'private', note: 'Controlled by 4th Viscount Rothermere (Jonathan Harmsworth). Delisted 2021' },
    funding: { model: 'Advertising (largest English-language newspaper website)' },
  },
  'mirror.co.uk': {
    displayName: 'THE MIRROR',
    type: 'national',
    countryCode: 'UK',
    ownership: { owner: 'Reach plc', type: 'public_traded', note: 'Traded on London Stock Exchange (RCH). UK\'s largest newspaper publisher' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'thesun.co.uk': {
    displayName: 'THE SUN',
    type: 'national',
    countryCode: 'UK',
    ownership: { owner: 'News UK', parent: 'News Corp (Murdoch family)', type: 'public_traded', note: 'News Corp trades NASDAQ (NWSA). UK\'s highest-circulation newspaper' },
    funding: { model: 'Advertising (free access)' },
  },
  'express.co.uk': {
    displayName: 'EXPRESS',
    type: 'national',
    countryCode: 'UK',
    ownership: { owner: 'Reach plc', type: 'public_traded', note: 'LSE (RCH). Acquired from Richard Desmond in 2018 for £127M' },
    funding: { model: 'Advertising & subscriptions' },
  },

  // ===========================================================================
  // AUSTRALIAN NATIONAL
  // ===========================================================================
  'theaustralian.com.au': {
    displayName: 'THE AUSTRALIAN',
    type: 'national',
    countryCode: 'AU',
    ownership: { owner: 'News Corp Australia', parent: 'News Corp (Murdoch family)', type: 'public_traded', note: 'News Corp trades NASDAQ (NWSA). Australia\'s only national broadsheet' },
    funding: { model: 'Subscriptions (paywall) & advertising' },
  },
  'smh.com.au': {
    displayName: 'SYDNEY MORNING HERALD',
    type: 'national',
    countryCode: 'AU',
    ownership: { owner: 'Nine Entertainment', type: 'public_traded', note: 'ASX (NEC). Part of former Fairfax Media, merged with Nine 2018' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'theage.com.au': {
    displayName: 'THE AGE',
    type: 'national',
    countryCode: 'AU',
    ownership: { owner: 'Nine Entertainment', type: 'public_traded', note: 'ASX (NEC). Melbourne broadsheet; part of former Fairfax Media' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'afr.com': {
    displayName: 'AFR',
    type: 'specialized',
    countryCode: 'AU',
    ownership: { owner: 'Nine Entertainment', type: 'public_traded', note: 'Australian Financial Review; acquired via Fairfax merger. ASX (NEC)' },
    funding: { model: 'Subscriptions (primary) & advertising' },
  },

  // ===========================================================================
  // NEW ZEALAND
  // ===========================================================================
  'nzherald.co.nz': {
    displayName: 'NZ HERALD',
    type: 'national',
    countryCode: 'NZ',
    ownership: { owner: 'New Zealand Media and Entertainment (NZME)', type: 'public_traded', note: 'Traded on NZX (NZM). New Zealand\'s largest newspaper' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'stuff.co.nz': {
    displayName: 'STUFF',
    type: 'national',
    countryCode: 'NZ',
    ownership: { owner: 'Stuff Limited', type: 'private', note: 'Sold by Nine Entertainment to CEO Sinead Boucher for $1 in 2020' },
    funding: { model: 'Advertising (free access model)' },
  },

  // ===========================================================================
  // IRELAND
  // ===========================================================================
  'irishtimes.com': {
    displayName: 'IRISH TIMES',
    type: 'national',
    countryCode: 'IE',
    ownership: { owner: 'The Irish Times Trust', type: 'trust', note: 'Trust structure ensures editorial independence; cannot be sold for profit' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'independent.ie': {
    displayName: 'IRISH INDEPENDENT',
    type: 'national',
    countryCode: 'IE',
    ownership: { owner: 'Mediahuis', type: 'private', note: 'Belgian media group acquired from INM in 2019. Ireland\'s largest newspaper' },
    funding: { model: 'Advertising & subscriptions' },
  },

  // ===========================================================================
  // NONPROFIT INVESTIGATIVE
  // ===========================================================================
  'propublica.org': {
    displayName: 'ProPublica',
    type: 'nonprofit',
    countryCode: 'US',
    ownership: { owner: 'ProPublica Inc', parent: 'ProPublica Inc', type: 'nonprofit', note: 'Independent nonprofit newsroom' },
    funding: { model: 'Donations, foundations', note: 'Pulitzer-winning investigative journalism' },
    lean: 'left',
  },
  'theintercept.com': {
    displayName: 'The Intercept',
    type: 'nonprofit',
    countryCode: 'US',
    ownership: { owner: 'First Look Media', parent: 'First Look Media', type: 'nonprofit', note: 'Founded by Pierre Omidyar' },
    funding: { model: 'Nonprofit grants', note: 'Adversarial investigative journalism' },
    lean: 'left',
  },
  'motherjones.com': {
    displayName: 'Mother Jones',
    type: 'nonprofit',
    countryCode: 'US',
    ownership: { owner: 'Foundation for National Progress', parent: 'Foundation for National Progress', type: 'nonprofit', note: 'Reader-supported nonprofit' },
    funding: { model: 'Donations, subscriptions', note: 'Progressive investigative reporting' },
    lean: 'left',
  },

  // ===========================================================================
  // PROGRESSIVE / LEFT MAGAZINES
  // ===========================================================================
  'newrepublic.com': {
    displayName: 'The New Republic',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Win McCormack', parent: 'Win McCormack', type: 'private', note: 'Owned by investor Win McCormack' },
    funding: { model: 'Subscriptions, advertising', note: 'Progressive political magazine since 1914' },
    lean: 'left',
  },
  'jacobin.com': {
    displayName: 'Jacobin',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Jacobin Foundation', parent: 'Jacobin Foundation', type: 'nonprofit', note: 'Democratic socialist quarterly' },
    funding: { model: 'Subscriptions', note: 'Socialist perspective on politics and economics' },
    lean: 'left',
  },
  'vox.com': {
    displayName: 'Vox',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Vox Media', type: 'private', note: 'Digital media company founded 2005' },
    funding: { model: 'Advertising, sponsored content' },
    lean: 'left',
  },
  'slate.com': {
    displayName: 'Slate',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'The Slate Group', parent: 'Graham Holdings', type: 'public_traded', note: 'Online magazine founded 1996' },
    funding: { model: 'Advertising, Slate Plus subscriptions' },
    lean: 'left',
  },
  'huffpost.com': {
    displayName: 'HuffPost',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'BuzzFeed', type: 'public_traded', note: 'Acquired by BuzzFeed in 2021' },
    funding: { model: 'Advertising' },
    lean: 'left',
  },
  'thenation.com': {
    displayName: 'The Nation',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'The Nation Company', type: 'private', note: 'Oldest continuously published weekly magazine in US (1865)' },
    funding: { model: 'Subscriptions, donations' },
    lean: 'left',
  },
  'democracynow.org': {
    displayName: 'Democracy Now',
    type: 'nonprofit',
    countryCode: 'US',
    ownership: { owner: 'Democracy Now! Productions', type: 'nonprofit', note: 'Independent news program since 1996' },
    funding: { model: 'Viewer donations, foundation grants' },
    lean: 'left',
  },

  // ===========================================================================
  // CENTER-RIGHT MEDIA
  // ===========================================================================
  'thedispatch.com': {
    displayName: 'The Dispatch',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'The Dispatch', parent: 'The Dispatch', type: 'private', note: 'Founded by Jonah Goldberg and Steve Hayes' },
    funding: { model: 'Subscriptions', note: 'Anti-Trump conservative analysis' },
    lean: 'center-right',
  },
  'thebulwark.com': {
    displayName: 'The Bulwark',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Bulwark Media', parent: 'Bulwark Media', type: 'private', note: 'Founded by Charlie Sykes' },
    funding: { model: 'Subscriptions, advertising', note: 'Never-Trump conservative commentary' },
    lean: 'center-right',
  },

  // ===========================================================================
  // ANALYSIS / THINK TANKS
  // ===========================================================================
  'thehill.com': {
    displayName: 'THE HILL',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Nexstar Media Group', type: 'public_traded', note: 'NASDAQ (NXST). Nexstar acquired The Hill in 2021 for $130M' },
    funding: { model: 'Advertising & events' },
    lean: 'center',
  },
  'politico.com': {
    displayName: 'POLITICO',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Axel Springer SE', type: 'private', note: 'German media conglomerate acquired Politico in 2021 for ~$1B. KKR is investor' },
    funding: { model: 'Advertising, Politico Pro subscriptions & events' },
    lean: 'center-left',
  },
  'responsiblestatecraft.org': {
    displayName: 'RESPONSIBLE STATECRAFT',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Quincy Institute for Responsible Statecraft', type: 'nonprofit', note: 'Think tank founded 2019 with Koch & Soros funding' },
    funding: { model: 'Foundation grants & donations' },
  },
  'foreignpolicy.com': {
    displayName: 'FOREIGN POLICY',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'The FP Group', parent: 'Graham Holdings Company', type: 'public_traded', note: 'NYSE (GHC). Founded by Samuel Huntington' },
    funding: { model: 'Subscriptions, advertising & events' },
  },
  'foreignaffairs.com': {
    displayName: 'FOREIGN AFFAIRS',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Council on Foreign Relations', type: 'nonprofit', note: 'Published by CFR since 1922. Influential foreign policy journal' },
    funding: { model: 'Subscriptions & CFR funding' },
  },
  'cfr.org': {
    displayName: 'CFR',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Council on Foreign Relations', type: 'nonprofit', note: 'Non-partisan think tank founded 1921. ~5,000 members' },
    funding: { model: 'Membership dues, corporate sponsors & foundation grants' },
  },
  'brookings.edu': {
    displayName: 'BROOKINGS',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Brookings Institution', type: 'nonprofit', note: 'Founded 1916. Centrist/center-left; largest US think tank' },
    funding: { model: 'Foundation grants, corporate donations & government contracts' },
  },
  'cato.org': {
    displayName: 'CATO INSTITUTE',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Cato Institute', type: 'nonprofit', note: 'Libertarian think tank founded 1977 by Charles Koch' },
    funding: { model: 'Individual donations & foundation grants (no government funding)' },
  },
  'heritage.org': {
    displayName: 'HERITAGE FOUNDATION',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'The Heritage Foundation', type: 'nonprofit', note: 'Conservative think tank founded 1973. Influential in Republican circles' },
    funding: { model: 'Individual donations, foundation grants & corporate sponsors' },
  },
  'carnegieendowment.org': {
    displayName: 'CARNEGIE',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Carnegie Endowment for International Peace', type: 'nonprofit', note: 'Founded 1910 by Andrew Carnegie. Global network' },
    funding: { model: 'Endowment income, foundation grants & government contracts' },
  },
  'rand.org': {
    displayName: 'RAND',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'RAND Corporation', type: 'nonprofit', note: 'Founded 1948; originally Douglas Aircraft/Air Force project' },
    funding: { model: 'US government contracts (primary), foundation grants' },
  },
  'diplomaticopinion.com': {
    displayName: 'DIPLOMATIC OPINION',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Diplomatic Opinion', type: 'private' },
    funding: { model: 'Not publicly disclosed' },
  },
  'harvardpoliticalreview.com': {
    displayName: 'HARVARD POLITICAL REVIEW',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Harvard Political Review', type: 'nonprofit', note: 'Student-run journal at Harvard; non-partisan since 1969' },
    funding: { model: 'Harvard University funding & advertising' },
  },
  'theharvardpoliticalreview.com': {
    displayName: 'HARVARD POLITICAL REVIEW',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Harvard Political Review', type: 'nonprofit', note: 'Student-run journal' },
    funding: { model: 'Harvard University funding' },
  },
  'leaders-mena.com': {
    displayName: 'LEADERS MENA',
    type: 'analysis',
    countryCode: 'AE',
    ownership: { owner: 'Leaders MENA', type: 'private', note: 'Middle East & North Africa focused' },
    funding: { model: 'Sponsorships & events' },
  },

  // ===========================================================================
  // MAGAZINES
  // ===========================================================================
  'forbes.com': {
    displayName: 'FORBES',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Forbes Media', parent: 'Integrated Whale Media (Austin Russell)', type: 'private', note: 'Luminar founder Austin Russell acquired majority stake 2022' },
    funding: { model: 'Advertising, Forbes contributor network & events' },
  },
  'time.com': {
    displayName: 'TIME',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Time USA, LLC', parent: 'Marc Benioff', type: 'private', note: 'Purchased by Salesforce founder Marc Benioff in 2018 for $190M' },
    funding: { model: 'Advertising, subscriptions & events' },
  },
  'newsweek.com': {
    displayName: 'NEWSWEEK',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Newsweek Media Group', parent: 'IBT Media', type: 'private', note: 'Owned by IBT Media (Dev Pragad). Controversial ownership history' },
    funding: { model: 'Advertising (primarily digital)' },
  },
  'economist.com': {
    displayName: 'THE ECONOMIST',
    type: 'magazine',
    countryCode: 'UK',
    ownership: { owner: 'The Economist Group', type: 'private', note: 'Agnelli family (Exor) ~43%, Rothschild family ~21%' },
    funding: { model: 'Subscriptions (primary) & advertising' },
    lean: 'center',
  },
  'theatlantic.com': {
    displayName: 'THE ATLANTIC',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'The Atlantic Monthly Group', parent: 'Emerson Collective (Laurene Powell Jobs)', type: 'private', note: 'Steve Jobs\' widow acquired majority stake in 2017' },
    funding: { model: 'Subscriptions, advertising & events (Atlantic Festival)' },
    lean: 'center-left',
  },
  'newyorker.com': {
    displayName: 'THE NEW YORKER',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'The New Yorker', parent: 'Condé Nast (Advance Publications)', type: 'private', note: 'Advance owned by Newhouse family since 1985' },
    funding: { model: 'Subscriptions & advertising' },
    lean: 'left',
  },

  // ===========================================================================
  // SPECIALIZED / FINANCIAL / TECH
  // ===========================================================================
  'bloomberg.com': {
    displayName: 'BLOOMBERG',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Michael Bloomberg', parent: 'Bloomberg L.P.', type: 'private', note: 'Michael Bloomberg owns ~88%. Revenue primarily from Terminal (~$10B/year)' },
    funding: { model: 'Bloomberg Terminal subscriptions (primary), news licensing & advertising' },
    lean: 'center',
  },
  'cnbc.com': {
    displayName: 'CNBC',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'NBCUniversal', parent: 'Comcast Corporation', type: 'public_traded', note: 'NASDAQ (CMCSA). Business & financial news network' },
    funding: { model: 'Advertising, cable carriage fees & CNBC Pro subscriptions' },
    lean: 'center',
  },
  'ft.com': {
    displayName: 'FINANCIAL TIMES',
    type: 'specialized',
    countryCode: 'UK',
    ownership: { owner: 'Nikkei, Inc.', type: 'private', note: 'Japanese media company acquired FT from Pearson in 2015 for $1.3B' },
    funding: { model: 'Subscriptions (1M+ paying readers) & advertising' },
    lean: 'center',
  },
  'wsj.com': {
    displayName: 'WALL STREET JOURNAL',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Dow Jones & Company', parent: 'News Corp (Murdoch family)', type: 'public_traded', note: 'News Corp trades NASDAQ (NWSA). Largest US newspaper by circulation' },
    funding: { model: 'Subscriptions (3M+) & advertising' },
    lean: 'center-right',
  },
  'nytimes.com': {
    displayName: 'THE NEW YORK TIMES',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'The New York Times Company', type: 'public_traded', note: 'NYSE: NYT. Founded 1851, "Gray Lady"' },
    funding: { model: 'Subscriptions (10M+) & advertising' },
    lean: 'center-left',
  },
  'washingtonpost.com': {
    displayName: 'THE WASHINGTON POST',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Jeff Bezos', parent: 'Nash Holdings', type: 'private', note: 'Purchased by Bezos in 2013 for $250M' },
    funding: { model: 'Subscriptions & advertising' },
    lean: 'center-left',
  },
  'business-standard.com': {
    displayName: 'BUSINESS STANDARD',
    type: 'specialized',
    countryCode: 'IN',
    ownership: { owner: 'Business Standard Limited', type: 'private', note: 'Founded by ABP Group; Kotak Mahindra is significant shareholder' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'livemint.com': {
    displayName: 'MINT',
    type: 'specialized',
    countryCode: 'IN',
    ownership: { owner: 'HT Media Ltd.', type: 'public_traded', note: 'Listed on BSE/NSE. Part of the Birla family media group' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'financialpost.com': {
    displayName: 'FINANCIAL POST',
    type: 'specialized',
    countryCode: 'CA',
    ownership: { owner: 'Postmedia Network', type: 'public_traded', note: 'Business section of National Post. TSX (PNC.A)' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'bnnbloomberg.ca': {
    displayName: 'BNN BLOOMBERG',
    type: 'specialized',
    countryCode: 'CA',
    ownership: { owner: 'Bell Media', parent: 'BCE Inc.', type: 'public_traded', note: 'Canadian business news; Bloomberg partnership. BCE trades TSX/NYSE' },
    funding: { model: 'Advertising & cable carriage fees' },
  },
  'wired.com': {
    displayName: 'WIRED',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Wired', parent: 'Condé Nast (Advance Publications)', type: 'private', note: 'Advance owned by Newhouse family' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'techcrunch.com': {
    displayName: 'TECHCRUNCH',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'TechCrunch', parent: 'Yahoo (Apollo Global Management)', type: 'private', note: 'Yahoo acquired from AOL/Verizon. Apollo acquired Yahoo 2021' },
    funding: { model: 'Advertising & TechCrunch+ subscriptions' },
  },
  'theverge.com': {
    displayName: 'THE VERGE',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Vox Media', type: 'private', note: 'Backed by NBCUniversal and venture capital' },
    funding: { model: 'Advertising & Vox Media brand partnerships' },
  },
  'marketwatch.com': {
    displayName: 'MARKETWATCH',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Dow Jones & Company', parent: 'News Corp (Murdoch family)', type: 'public_traded', note: 'News Corp trades NASDAQ (NWSA). Sister to WSJ' },
    funding: { model: 'Advertising (free access)' },
  },
  'barrons.com': {
    displayName: 'BARRONS',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Dow Jones & Company', parent: 'News Corp (Murdoch family)', type: 'public_traded', note: 'Premium financial weekly since 1921' },
    funding: { model: 'Subscriptions (paywall) & advertising' },
  },
  'investopedia.com': {
    displayName: 'INVESTOPEDIA',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Investopedia', parent: 'Dotdash Meredith (IAC)', type: 'public_traded', note: 'IAC trades NASDAQ (IAC)' },
    funding: { model: 'Advertising & affiliate marketing' },
  },
  'seekingalpha.com': {
    displayName: 'SEEKING ALPHA',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Seeking Alpha Ltd.', type: 'private', note: 'Crowd-sourced financial analysis; venture-backed' },
    funding: { model: 'Premium subscriptions & advertising' },
  },
  'fool.com': {
    displayName: 'MOTLEY FOOL',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'The Motley Fool Holdings, Inc.', type: 'private', note: 'Founded 1993 by Tom & David Gardner' },
    funding: { model: 'Premium subscription services (Stock Advisor, Rule Breakers)' },
  },
  'zacks.com': {
    displayName: 'ZACKS',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Zacks Investment Research', type: 'private', note: 'Founded 1978 by Len Zacks' },
    funding: { model: 'Premium subscriptions & advertising' },
  },
  '247wallst.com': {
    displayName: '24/7 WALL ST',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: '24/7 Wall St. LLC', type: 'private' },
    funding: { model: 'Advertising' },
  },
  'investing.com': {
    displayName: 'INVESTING.COM',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Investing.com', parent: 'Fusion Media Ltd.', type: 'private' },
    funding: { model: 'Advertising & broker partnerships' },
  },
  'marketscreener.com': {
    displayName: 'MARKETSCREENER',
    type: 'specialized',
    countryCode: 'FR',
    ownership: { owner: 'Surperformance SAS', type: 'private' },
    funding: { model: 'Premium subscriptions & advertising' },
  },
  'thestreet.com': {
    displayName: 'THE STREET',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'TheStreet, Inc.', parent: 'Maven', type: 'private', note: 'Founded by Jim Cramer 1996. Acquired by Maven 2019' },
    funding: { model: 'Advertising & premium subscriptions' },
  },
  'kiplinger.com': {
    displayName: 'KIPLINGER',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Kiplinger Washington Editors', parent: 'Future plc', type: 'public_traded', note: 'UK-based Future plc acquired 2019. LSE (FUTR)' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'morningstar.com': {
    displayName: 'MORNINGSTAR',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Morningstar, Inc.', type: 'public_traded', note: 'NASDAQ (MORN). Independent investment research founded 1984' },
    funding: { model: 'Data/software licensing, Morningstar Premium subscriptions' },
  },
  'benzinga.com': {
    displayName: 'BENZINGA',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Benzinga', parent: 'Beringer Capital', type: 'private', note: 'Acquired by Beringer Capital 2021' },
    funding: { model: 'Advertising, data licensing & Benzinga Pro subscriptions' },
  },
  'tradingview.com': {
    displayName: 'TRADINGVIEW',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'TradingView Inc.', type: 'private', note: 'Charting platform valued at $3B+; backed by Tiger Global' },
    funding: { model: 'Premium subscriptions & broker partnerships' },
  },
  'biv.com': {
    displayName: 'BIV',
    type: 'specialized',
    countryCode: 'CA',
    ownership: { owner: 'Business in Vancouver', parent: 'Glacier Media', type: 'public_traded', note: 'TSX Venture (GVC)' },
    funding: { model: 'Subscriptions & advertising' },
  },
  'virginiabusiness.com': {
    displayName: 'VIRGINIA BUSINESS',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Virginia Business Magazine', type: 'private' },
    funding: { model: 'Advertising & subscriptions' },
  },
  'producer.com': {
    displayName: 'WESTERN PRODUCER',
    type: 'specialized',
    countryCode: 'CA',
    ownership: { owner: 'Glacier FarmMedia', parent: 'Glacier Media', type: 'public_traded', note: 'TSX Venture (GVC). Canadian agricultural publication' },
    funding: { model: 'Subscriptions & agricultural advertising' },
  },
  'successfulfarming.com': {
    displayName: 'SUCCESSFUL FARMING',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Meredith Corporation', parent: 'Dotdash Meredith (IAC)', type: 'public_traded', note: 'IAC trades NASDAQ (IAC)' },
    funding: { model: 'Advertising & subscriptions' },
  },
  // ===========================================================================
  // ADDITIONAL SOURCES - Added for coverage gaps
  // ===========================================================================
  'rollingstone.com': {
    displayName: 'Rolling Stone',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Penske Media Corporation', parent: 'Penske Media Corporation', type: 'private', note: 'Entertainment and culture magazine since 1967' },
    funding: { model: 'Advertising & subscriptions' },
    lean: 'left',
  },
  'cleveland.com': {
    displayName: 'Cleveland.com',
    type: 'local',
    countryCode: 'US',
    ownership: { owner: 'Advance Local', parent: 'Advance Publications', type: 'private', note: 'Northeast Ohio regional news' },
    funding: { model: 'Advertising & subscriptions' },
    lean: 'center-left',
  },
  'dnyuz.com': {
    displayName: 'DNYUZ',
    type: 'syndication',
    countryCode: 'US',
    ownership: { owner: 'Unknown', type: 'private', note: 'News aggregator' },
    funding: { model: 'Advertising' },
    lean: 'center',
  },
  'wikipedia.org': {
    displayName: 'Wikipedia',
    type: 'reference',
    countryCode: 'US',
    ownership: { owner: 'Wikimedia Foundation', type: 'nonprofit', note: 'Crowdsourced encyclopedia' },
    funding: { model: 'Donations' },
    lean: 'center',
  },
  'en.wikipedia.org': {
    displayName: 'Wikipedia',
    type: 'reference',
    countryCode: 'US',
    ownership: { owner: 'Wikimedia Foundation', type: 'nonprofit', note: 'Crowdsourced encyclopedia' },
    funding: { model: 'Donations' },
    lean: 'center',
  },
  // ===========================================================================
  // ADDITIONAL MAGAZINES & OPINION OUTLETS
  // ===========================================================================
  'salon.com': {
    displayName: 'Salon',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Salon Media Group', type: 'private', note: 'Progressive online magazine' },
    funding: { model: 'Advertising & subscriptions' },
    lean: 'left',
  },
  'vanityfair.com': {
    displayName: 'Vanity Fair',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Condé Nast', parent: 'Advance Publications', type: 'private' },
    funding: { model: 'Advertising & subscriptions' },
    lean: 'center-left',
  },
  'businessinsider.com': {
    displayName: 'Business Insider',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Insider Inc', parent: 'Axel Springer', type: 'private' },
    funding: { model: 'Advertising & subscriptions' },
    lean: 'center-left',
  },
  'thedailybeast.com': {
    displayName: 'The Daily Beast',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'The Daily Beast Company', parent: 'IAC', type: 'public_traded' },
    funding: { model: 'Advertising & subscriptions' },
    lean: 'left',
  },
  'rawstory.com': {
    displayName: 'Raw Story',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Raw Story Media Inc', type: 'private', note: 'Progressive news site' },
    funding: { model: 'Advertising' },
    lean: 'left',
  },
  'mediaite.com': {
    displayName: 'Mediaite',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Mediaite LLC', type: 'private', note: 'Media news and opinion' },
    funding: { model: 'Advertising' },
    lean: 'center',
  },
  'theweek.com': {
    displayName: 'The Week',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Future plc', type: 'public_traded', note: 'News digest magazine' },
    funding: { model: 'Advertising & subscriptions' },
    lean: 'center',
  },
  'reason.com': {
    displayName: 'Reason',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'Reason Foundation', type: 'nonprofit', note: 'Libertarian magazine' },
    funding: { model: 'Donations & subscriptions' },
    lean: 'center-right',
  },
  'theepochtimes.com': {
    displayName: 'The Epoch Times',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Epoch Media Group', type: 'private', note: 'Falun Gong-affiliated' },
    funding: { model: 'Subscriptions & donations' },
    lean: 'right',
  },
  'oann.com': {
    displayName: 'OAN',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Herring Networks', type: 'private', note: 'One America News Network' },
    funding: { model: 'Cable & advertising' },
    lean: 'right',
  },
  'ijr.com': {
    displayName: 'IJR',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Independent Journal Review', type: 'private' },
    funding: { model: 'Advertising' },
    lean: 'center-right',
  },
  'hotair.com': {
    displayName: 'Hot Air',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Salem Media Group', type: 'public_traded', note: 'Conservative blog' },
    funding: { model: 'Advertising' },
    lean: 'right',
  },
  'pjmedia.com': {
    displayName: 'PJ Media',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Salem Media Group', type: 'public_traded', note: 'Conservative commentary' },
    funding: { model: 'Advertising' },
    lean: 'right',
  },
};

// Get source info with transparency data
function getSourceInfo(domain: string): SourceInfo {
  if (!domain) return { displayName: 'SOURCE', type: 'local', countryCode: 'US' };

  // Normalize domain: remove www., m., and lowercase
  const normalized = domain
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/^m\./, '')
    .replace(/^amp\./, '');

  // Check exact match first
  if (sources[normalized]) {
    return sources[normalized];
  }

  // Handle special cases for major newspapers
  if (normalized.includes('washingtonpost')) {
    return sources['washingtonpost.com'];
  }
  if (normalized.includes('nytimes')) {
    return sources['nytimes.com'];
  }
  if (normalized.includes('abcnews')) {
    return sources['abcnews.go.com'];
  }

  // Check partial matches (e.g., nytimes.com matches www.nytimes.com)
  for (const [key, info] of Object.entries(sources)) {
    if (normalized.includes(key) || key.includes(normalized)) return info;
  }

  const lower = normalized;
  
  // Country from TLD for unknown sources
  let countryCode = 'US';
  if (lower.endsWith('.uk') || lower.endsWith('.co.uk')) countryCode = 'UK';
  else if (lower.endsWith('.ca')) countryCode = 'CA';
  else if (lower.endsWith('.au') || lower.endsWith('.com.au')) countryCode = 'AU';
  else if (lower.endsWith('.de')) countryCode = 'DE';
  else if (lower.endsWith('.in') || lower.endsWith('.co.in')) countryCode = 'IN';
  else if (lower.endsWith('.nz') || lower.endsWith('.co.nz')) countryCode = 'NZ';
  else if (lower.endsWith('.ie')) countryCode = 'IE';
  else if (lower.endsWith('.fr')) countryCode = 'FR';
  else if (lower.endsWith('.il') || lower.endsWith('.co.il')) countryCode = 'IL';
  else if (lower.endsWith('.jp') || lower.endsWith('.co.jp')) countryCode = 'JP';
  else if (lower.endsWith('.kr') || lower.endsWith('.co.kr')) countryCode = 'KR';
  else if (lower.endsWith('.cn') || lower.endsWith('.com.cn')) countryCode = 'CN';
  else if (lower.endsWith('.ru')) countryCode = 'RU';
  else if (lower.endsWith('.br') || lower.endsWith('.com.br')) countryCode = 'BR';
  else if (lower.endsWith('.mx') || lower.endsWith('.com.mx')) countryCode = 'MX';
  else if (lower.endsWith('.sg')) countryCode = 'SG';
  else if (lower.endsWith('.hk') || lower.endsWith('.com.hk')) countryCode = 'HK';
  else if (lower.endsWith('.th') || lower.endsWith('.co.th')) countryCode = 'TH';
  
  // Smart fallback: detect type from domain name patterns
  let type: SourceType = 'local';
  if (lower.includes('financial') || lower.includes('finance') || 
      lower.includes('business') || lower.includes('market') ||
      lower.includes('trading') || lower.includes('invest')) {
    type = 'specialized';
  }
  
  const parts = domain.split('.');
  // Use shared source data for political lean (falls back to 'center' if unknown)
  return { displayName: parts[0].toUpperCase(), type, countryCode, lean: getPoliticalLean(domain) };
}

// --- Fetch Article Title from URL ---
async function fetchArticleTitle(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MirrorSource/1.0)' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();
    // Extract <title> tag content
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      // Clean up: remove site name suffixes like " - CNN" or " | BBC"
      let title = titleMatch[1].trim();
      title = title.replace(/\s*[\|\-–—]\s*[^|\-–—]+$/, '').trim();
      return title.length > 10 ? title : null;
    }
    return null;
  } catch {
    return null;
  }
}

// --- URL to Keywords Extraction ---
function extractKeywordsFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const segments = path.split('/').filter(s => s.length > 0);

    const noiseWords = new Set([
      'article', 'articles', 'news', 'story', 'stories', 'post', 'posts',
      'content', 'index', 'page', 'html', 'htm', 'php', 'aspx', 'amp',
      'live', 'video', 'watch', 'read', 'the', 'and', 'for', 'with',
      'from', 'that', 'this', 'have', 'has', 'are', 'was', 'were',
      'been', 'will', 'would', 'could', 'should', 'into', 'over',
      'after', 'before', 'id', 'newsfront'
    ]);

    // Find best slug
    let bestSlug = '';
    for (const segment of segments) {
      if (/^\d+$/.test(segment)) continue;
      if (/^\d{2,4}$/.test(segment)) continue;
      if (noiseWords.has(segment.toLowerCase())) continue;
      if (segment.toLowerCase() === 'us' || segment.toLowerCase() === 'uk') continue;

      if (segment.includes('-') && segment.length > bestSlug.length) {
        bestSlug = segment;
      }
    }

    if (!bestSlug) return null;

    const words = bestSlug
      .toLowerCase()
      .split(/[-_]/)
      .filter(w => w.length > 2)
      .filter(w => !noiseWords.has(w))
      .slice(0, 6);

    return words.length >= 2 ? words.join(' ') : null;
  } catch {
    return null;
  }
}

// --- Helpers ---
function extractJson(text: string): any {
  let cleaned = text.trim().replace(/^```[a-z]*\s*/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)); } catch {}
  }
  return null;
}

// --- URL Validation ---
function validateUrl(url: string): { valid: boolean; error?: AppError } {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: false, error: createError('INVALID_URL') };
  }
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: createError('INVALID_URL') };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: createError('INVALID_URL') };
  }
}

// =============================================================================
// STEP 1: THE EYES - Google Custom Search
// =============================================================================
interface CSEResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  source?: 'google' | 'brave';
}

// =============================================================================
// BRAVE SEARCH - Primary search engine
// =============================================================================
async function searchWithBrave(query: string): Promise<CSEResult[]> {
  if (!BRAVE_API_KEY) {
    console.log('[Brave] No API key configured, skipping');
    return [];
  }

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20&search_lang=en&country=us&freshness=pw`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log('[Brave] API error:', response.status);
      return [];
    }

    const data = await response.json();

    const results: CSEResult[] = (data.web?.results || []).map((item: any) => {
      let domain = '';
      try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}

      return {
        url: item.url,
        title: item.title || '',
        snippet: item.description || '',
        domain,
        source: 'brave' as const,
      };
    });

    console.log('[Brave] Found', results.length, 'results');
    return results;

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('[Brave] Search timeout');
    } else {
      console.error('[Brave] Search error:', error);
    }
    return [];
  }
}

// Filter out low-quality results using 50% keyword match ratio
function filterQualityResults(results: CSEResult[], searchQuery: string): CSEResult[] {
  if (!results || !Array.isArray(results)) return [];
  if (!searchQuery || typeof searchQuery !== 'string') return results;

  const stopWords = ['this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'about', 'which', 'would', 'could', 'should', 'there', 'where', 'when', 'what', 'news', 'report', 'story'];

  const SPAM_KEYWORDS = [
    'crossword', 'puzzle', 'clue', 'wordle', 'answer key', 'cheat',
    'coupon', 'promo code', 'discount code',
    'essay', 'homework help',
    'lyrics', 'chords', 'tabs',
    'horoscope', 'zodiac',
    'recipe', 'calories'
  ];

  const SPAM_DOMAINS = [
    // Gaming guides & walkthroughs
    'tryhardguides.com', 'progameguides.com', 'gamerjournalist.com',
    'attackofthefanboy.com', 'gamerant.com', 'screenrant.com',
    // Gaming & entertainment (not news)
    'fandomwire.com', 'fandom.com', 'gosugamers.net', 'biztoc.com',
    'cbr.com', 'polygon.com', 'kotaku.com', 'ign.com', 'pcgamer.com',
    // Homework & reference
    'quizlet.com', 'brainly.com', 'chegg.com', 'coursehero.com',
    'genius.com', 'azlyrics.com',
    // Recipes & lifestyle
    'allrecipes.com', 'food.com', 'delish.com',
    // Shopping & social
    'pinterest.com', 'etsy.com', 'amazon.com',
    // Reference (not news)
    'wikipedia.org', 'en.wikipedia.org', 'britannica.com',
    'merriam-webster.com', 'investopedia.com'
  ];

  const queryWords = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !stopWords.includes(w));

  if (queryWords.length === 0) return results;

  const scored = results.map(result => {
    if (!result || !result.url) return { result, score: 0, passed: false };

    const urlLower = (result.url || '').toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
    const snippetLower = (result.snippet || '').toLowerCase();

    // Block known spam domains
    if (SPAM_DOMAINS.some(d => urlLower.includes(d))) {
      console.log(`[Spam Filter] Blocked domain: ${result.url}`);
      return { result, score: 0, passed: false };
    }

    // Block spam content types by title/snippet keywords
    if (SPAM_KEYWORDS.some(k => titleLower.includes(k) || snippetLower.includes(k))) {
      console.log(`[Spam Filter] Blocked keyword in: ${result.title}`);
      return { result, score: 0, passed: false };
    }

    try {
      const path = new URL(result.url).pathname;
      if (path === '/' || path === '') return { result, score: 0, passed: false };
    } catch { return { result, score: 0, passed: false }; }

    const text = ((result.title || '') + ' ' + (result.snippet || '')).toLowerCase();

    let matches = 0;
    for (const word of queryWords) {
      if (text.includes(word)) matches++;
    }

    const matchRatio = matches / queryWords.length;

    let passed = false;
    if (queryWords.length <= 2) {
      passed = matches >= 1;
    } else if (queryWords.length <= 4) {
      passed = matchRatio >= 0.5;
    } else {
      passed = matchRatio >= 0.4;
    }

    const titleHasMatch = queryWords.some(w => titleLower.includes(w));
    if (queryWords.length > 1 && !titleHasMatch) {
      passed = false;
    }

    return { result, score: matches, passed };
  });

  const passing = scored
    .filter(s => s.passed)
    .sort((a, b) => b.score - a.score)
    .map(s => s.result);

  console.log(`[Quality Filter] Query: "${searchQuery}" | Words: ${queryWords.length} | In: ${results.length} -> Out: ${passing.length}`);

  return passing;
}

// Diversify results by source type using round-robin
function diversifyResults(results: CSEResult[], maxResults: number = 15): CSEResult[] {
  // Defensive null checks
  if (!results || !Array.isArray(results) || results.length === 0) return [];

  // Group by political lean instead of just type
  const byLean: Record<string, CSEResult[]> = {
    'right': [],
    'center-right': [],
    'center': [],
    'center-left': [],
    'left': [],
    'unknown': []
  };

  for (const result of results) {
    if (!result || !result.domain) continue;
    const info = getSourceInfo(result.domain);
    const lean = info.lean || 'unknown';
    byLean[lean].push(result);
  }

  // Round-robin from each lean category across the political spectrum
  const diverse: CSEResult[] = [];
  const leans = ['left', 'center-left', 'center', 'center-right', 'right', 'unknown'];
  let added = true;
  let round = 0;

  while (added && diverse.length < maxResults) {
    added = false;
    for (const lean of leans) {
      if (byLean[lean][round]) {
        // Avoid duplicates by domain
        if (!diverse.find(d => d.domain === byLean[lean][round].domain)) {
          diverse.push(byLean[lean][round]);
          added = true;
        }
        if (diverse.length >= maxResults) break;
      }
    }
    round++;
  }

  // Log lean breakdown for debugging
  console.log('[CSE] Lean breakdown:', {
    right: diverse.filter(r => getSourceInfo(r.domain).lean === 'right').length,
    centerRight: diverse.filter(r => getSourceInfo(r.domain).lean === 'center-right').length,
    center: diverse.filter(r => getSourceInfo(r.domain).lean === 'center').length,
    centerLeft: diverse.filter(r => getSourceInfo(r.domain).lean === 'center-left').length,
    left: diverse.filter(r => getSourceInfo(r.domain).lean === 'left').length,
    unknown: diverse.filter(r => !getSourceInfo(r.domain).lean).length,
  });

  return diverse;
}

// =============================================================================
// STEP 2: THE BRAIN - Gemini Synthesis
// =============================================================================
interface CommonGroundFact {
  label: string;
  value: string;
}

interface KeyDifference {
  label: string;
  value: string;
}

interface IntelBrief {
  summary: string;
  commonGround: CommonGroundFact[] | string;  // Array preferred, string for backward compatibility
  keyDifferences: KeyDifference[] | string;   // Array for differences, string for consensus message
}

async function synthesizeWithGemini(searchResults: CSEResult[], originalQuery: string, timeoutMs: number = 18000): Promise<IntelBrief | null> {
  // Limit sources to prevent timeout - use first 10 for synthesis
  const sourcesForSynthesis = searchResults.slice(0, 10);
  console.log(`[Gemini] Using ${sourcesForSynthesis.length} of ${searchResults.length} sources for synthesis`);

  const context = sourcesForSynthesis.map((r, i) =>
    `[Source ${i + 1}: ${r.domain}]\nTitle: ${r.title}\nSnippet: ${r.snippet}`
  ).join('\n\n');

  const prompt = `You are a news intelligence analyst. Based ONLY on the sources provided below, write a brief analysis.

CRITICAL: First, identify the PRIMARY EVENT the user is researching. Then ONLY analyze coverage of that specific event. Ignore tangential events.

STORY QUERY: "${originalQuery}"

SOURCES:
${context}

RESPOND IN JSON FORMAT:
{
  "summary": "3-4 sentences summarizing THE PRIMARY EVENT ONLY. Grade 6-8 reading level. Bold only the KEY TAKEAWAY of each sentence using **bold** syntax. Max 4 bold phrases. Do NOT include unrelated historical events.",
  "commonGround": [{"label": "Short category", "value": "What sources agree on ABOUT THE PRIMARY EVENT"}, ...],
  "keyDifferences": [{"label": "Topic", "value": "How sources differ ON THE PRIMARY EVENT"}, ...] OR "Sources present a consistent narrative on this story."
}

RULES:
- ABSOLUTE PROHIBITION: Never write "(Source X)", "[Source X]", "Source 1", or any variation. No source numbers anywhere. Use Publisher Names ONLY (e.g., "Reuters", "CNN", "Fox News").
- ONLY use information from the sources above.
- TIME AWARENESS: If sources differ because some are older (e.g., "Manhunt underway" vs "Suspect caught"), trust the latest status. Do NOT list outdated early reports as a "Key Difference". Only list genuine conflicts where sources disagree on the *same* facts at the *same* time.
- CITATION STYLE: Refer to sources by their Publisher Name as written in the text (e.g., "**Reuters**", "**CNN**", "**Al Jazeera**").
- Bold publisher names in keyDifferences using **markdown**.
- commonGround: 2-4 fact objects.
- keyDifferences: Look for differences in FACTS, FRAMING, and TONE across sources. Do NOT just check factual agreement.
  * Factual difference: Source A says "9 killed", Source B says "15 killed" → KEY DIFFERENCE
  * Framing difference: Source A says "Politician defends policy", Source B says "Politician under fire for policy" → KEY DIFFERENCE
  * Tone difference: Source A uses "crisis" framing, Source B uses "routine" framing → KEY DIFFERENCE
  * Omission difference: Source A mentions the cost, Source B omits it entirely → KEY DIFFERENCE
  Return 1-3 difference objects highlighting the most significant divergences. Keep each "value" under 25 words.
  ONLY return a consensus string if tone, framing, AND facts are nearly identical across ALL sources. This should be rare.
- CONSENSUS RULE: Only return a consensus string when there are genuinely NO meaningful differences in framing or tone. If you identified ANY keyDifferences, do NOT also claim consensus. Default to finding differences - consensus should be rare.
- Use simple language
- Be concise - prioritize speed over length.

FINAL CHECK: Before responding, verify you have not included any "(Source" or "Source 1" text anywhere in your response.`.trim();

  // Create timeout promise
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.log(`[Gemini] Request timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);
  });

  try {
    // Race between Gemini call and timeout
    const geminiPromise = genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const geminiResponse: any = await Promise.race([geminiPromise, timeoutPromise]);

    // Check if timeout won
    if (geminiResponse === null) {
      return null; // Timeout - caller handles fallback
    }

    let text: string | undefined;
    if (geminiResponse?.response && typeof geminiResponse.response.text === 'function') {
      text = geminiResponse.response.text();
    } else if (Array.isArray(geminiResponse?.candidates)) {
      text = geminiResponse.candidates[0]?.content?.parts?.[0]?.text;
    }

    if (!text) {
      return {
        summary: `We found **${searchResults.length} sources** covering this story. Click any source below to read their coverage.`,
        commonGround: [],
        keyDifferences: '',
      };
    }

    const parsed = extractJson(text);
    if (!parsed) {
      return {
        summary: `We found **${searchResults.length} sources** covering this story. Click any source below to read their coverage.`,
        commonGround: [],
        keyDifferences: '',
      };
    }

    // Handle commonGround as array or string for backward compatibility
    let commonGround: CommonGroundFact[] | string = [];
    if (Array.isArray(parsed.commonGround)) {
      commonGround = parsed.commonGround.filter((f: any) => f.label && f.value);
    } else if (typeof parsed.commonGround === 'string') {
      commonGround = parsed.commonGround.trim();
    }

    // Handle keyDifferences as array (conflicts) or string (consensus)
    let keyDifferences: KeyDifference[] | string = '';
    if (Array.isArray(parsed.keyDifferences)) {
      keyDifferences = parsed.keyDifferences.filter((f: any) => f.label && f.value);
    } else if (typeof parsed.keyDifferences === 'string') {
      keyDifferences = parsed.keyDifferences.trim();
    }

    return {
      summary: (parsed.summary || '').trim(),
      commonGround,
      keyDifferences,
    };
  } catch (error: any) {
    console.error('[Gemini] Synthesis error:', error?.message);
    return null; // Return null so caller can handle fallback
  }
}

// =============================================================================
// STEP 3: PROCESS RESULTS - Apply badges, transparency, and sort
// =============================================================================
interface ProcessedSource {
  uri: string;
  title: string;
  snippet: string;
  displayName: string;
  sourceDomain: string;
  sourceType: SourceType;
  countryCode: string;
  isSyndicated: boolean;
  // NEW: Transparency data
  ownership?: OwnershipInfo;
  funding?: FundingInfo;
  // Political lean for comparison feature
  politicalLean?: PoliticalLean;
}

// Detect opinion-laden or characterization language in search query
function detectQueryBias(query: string): string | null {
  if (!query) return null;

  const opinionPatterns = [
    // Negative characterizations
    /\b(maniac|lunatic|crazy|insane|unhinged|deranged|mad|nuts)\b/i,
    /\b(liar|fraud|criminal|corrupt|evil|dangerous|extremist)\b/i,
    /\b(failed|failing|disaster|catastrophe|worst|terrible)\b/i,
    // Positive characterizations
    /\b(genius|brilliant|amazing|best|greatest|hero)\b/i,
    // Clickbait framing words
    /\b(slams?|destroys?|obliterates?|owns?|wrecks?|eviscerates?)\b/i,
    /\b(exposed|busted|caught|admits?|confesses?)\b/i,
    /\b(humiliates?|embarrasses?|shocks?|stuns?)\b/i,
  ];

  for (const pattern of opinionPatterns) {
    if (pattern.test(query)) {
      console.log(`[QueryBias] Detected opinion language in query: "${query}"`);
      return 'This search includes opinion language which may limit perspective diversity.';
    }
  }
  return null;
}

// Analyze political diversity of results
// gapFillInfo: tells us if we already tried to find underrepresented sources
function analyzePoliticalDiversity(
  results: ProcessedSource[],
  gapFillInfo?: { attempted: { right: boolean; left: boolean }; found: { right: number; left: number } }
): {
  isBalanced: boolean;
  leftCount: number;
  centerCount: number;
  rightCount: number;
  warning: string | null;
} {
  let leftCount = 0;    // left + center-left
  let centerCount = 0;  // center
  let rightCount = 0;   // right + center-right

  console.log(`[Diversity] Analyzing ${results.length} sources...`);

  for (const result of results) {
    const domain = result.sourceDomain || '';
    const info = getSourceInfo(domain);
    const lean = info.lean || 'center';

    console.log(`[Diversity] ${domain} -> lean: ${lean}`);

    if (lean === 'left' || lean === 'center-left') leftCount++;
    else if (lean === 'right' || lean === 'center-right') rightCount++;
    else centerCount++;
  }

  const total = results.length;
  if (total === 0) return { isBalanced: true, leftCount: 0, centerCount: 0, rightCount: 0, warning: null };

  const leftPct = leftCount / total;
  const rightPct = rightCount / total;

  console.log(`[Diversity] Counts - Left: ${leftCount} (${(leftPct * 100).toFixed(0)}%), Center: ${centerCount}, Right: ${rightCount} (${(rightPct * 100).toFixed(0)}%)`);

  // Check for imbalance (more than 60% from one side)
  let warning: string | null = null;
  let isBalanced = true;

  if (leftPct > 0.6 && rightCount < 2) {
    isBalanced = false;
    // More accurate warning based on whether we tried gap fill
    if (gapFillInfo?.attempted.right && gapFillInfo.found.right === 0) {
      warning = `We searched specifically for right-leaning coverage but found none. This story may not be covered by these outlets.`;
    } else {
      warning = `Sources lean left (${leftCount}/${total}). Right-leaning perspectives may be underrepresented.`;
    }
    console.log(`[Diversity] WARNING: ${warning}`);
  } else if (rightPct > 0.6 && leftCount < 2) {
    isBalanced = false;
    // More accurate warning based on whether we tried gap fill
    if (gapFillInfo?.attempted.left && gapFillInfo.found.left === 0) {
      warning = `We searched specifically for left-leaning coverage but found none. This story may not be covered by these outlets.`;
    } else {
      warning = `Sources lean right (${rightCount}/${total}). Left-leaning perspectives may be underrepresented.`;
    }
    console.log(`[Diversity] WARNING: ${warning}`);
  } else {
    console.log(`[Diversity] Sources are balanced - no warning`);
  }

  return { isBalanced, leftCount, centerCount, rightCount, warning };
}

function processSearchResults(cseResults: CSEResult[]): ProcessedSource[] {
  const seen = new Set<string>();
  const processed: ProcessedSource[] = [];

  for (const result of cseResults) {
    if (!result.domain || seen.has(result.domain)) continue;
    seen.add(result.domain);

    const sourceInfo = getSourceInfo(result.domain);
    
    processed.push({
      uri: result.url,
      title: result.title,
      snippet: result.snippet || '',
      displayName: sourceInfo.displayName,
      sourceDomain: result.domain,
      sourceType: sourceInfo.type,
      countryCode: sourceInfo.countryCode,
      isSyndicated: false,
      // Include transparency data
      ownership: sourceInfo.ownership,
      funding: sourceInfo.funding,
      politicalLean: sourceInfo.lean,
    });
  }

  // Sort by source type priority
  const typePriority: Record<SourceType, number> = {
    'wire': 0,
    'specialized': 1,
    'national': 2,
    'international': 3,
    'public': 4,
    'public-trust': 4,
    'nonprofit': 5,
    'analysis': 6,
    'corporate': 7,
    'syndication': 8,
    'magazine': 9,
    'local': 10,
    'state': 11,
    'state-funded': 11,
    'reference': 12,
    'platform': 13,
  };

  processed.sort((a, b) => typePriority[a.sourceType] - typePriority[b.sourceType]);
  return processed;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limit Check
    const limitCheck = await checkRateLimit(req);
    if (!limitCheck.success) {
      const error = createError('RATE_LIMITED', `Daily limit reached. You have 0/${limitCheck.info.limit} remaining.`);
      return NextResponse.json(
        { error: error.userMessage, errorType: error.type, retryable: error.retryable },
        { status: error.statusCode, headers: corsHeaders }
      );
    }

    // 2. Parse Request Body
    let body: any;
    try { body = await req.json(); } catch { 
      return NextResponse.json(
        { error: 'Invalid request body', errorType: 'INVALID_URL', retryable: false },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Determine search query
    const hasKeywords = body.keywords && typeof body.keywords === 'string' && body.keywords.trim();
    const hasUrl = body.url && typeof body.url === 'string' && body.url.trim();

    if (!hasKeywords && !hasUrl) {
      const error = createError('INVALID_URL');
      return NextResponse.json(
        { error: error.userMessage, errorType: error.type, retryable: error.retryable },
        { status: error.statusCode, headers: corsHeaders }
      );
    }

    let searchQuery: string;
    let isPaywalled = false;

    if (hasKeywords) {
      searchQuery = body.keywords.trim();
      if (searchQuery.length < 3) {
        return NextResponse.json(
          { error: 'Please enter at least a few keywords to search.', errorType: 'INVALID_KEYWORDS', retryable: false },
          { status: 400, headers: corsHeaders }
        );
      }
      // Use keywords directly - no quote wrapping
    } else {
      const validation = validateUrl(body.url);
      if (!validation.valid && validation.error) {
        return NextResponse.json(
          { error: validation.error.userMessage, errorType: validation.error.type, retryable: validation.error.retryable },
          { status: validation.error.statusCode, headers: corsHeaders }
        );
      }

      const url = body.url.trim();
      isPaywalled = isPaywalledSource(url);

      // PRIORITY 1: Try to fetch the actual article title
      console.log(`[Query] Attempting to fetch article title from: ${url}`);
      const articleTitle = await fetchArticleTitle(url);

      if (articleTitle) {
        console.log(`[Query] Got article title: "${articleTitle}"`);
        // Use the title directly - no quote wrapping
        searchQuery = articleTitle;
      } else {
        // FALLBACK: Extract from URL slug
        console.log(`[Query] Title fetch failed, falling back to URL extraction`);
        const extractedKeywords = extractKeywordsFromUrl(url);
        console.log('[DEBUG] URL extraction result:', extractedKeywords);
        console.log('[DEBUG] extractedKeywords type:', typeof extractedKeywords);
        console.log('[DEBUG] extractedKeywords length:', extractedKeywords?.length);

        if (!extractedKeywords) {
          console.log('[DEBUG] EARLY EXIT: extractedKeywords is null/empty');
          return NextResponse.json({
            summary: null,
            commonGround: null,
            keyDifferences: null,
            alternatives: [],
            isPaywalled,
            needsKeywords: true,
            error: 'This link doesn\'t contain readable keywords. Please enter 3-5 key words from the story.',
            errorType: 'NEEDS_KEYWORDS',
            retryable: false,
          }, { headers: corsHeaders });
        }

        // Use extracted keywords directly - no quote wrapping
        searchQuery = extractedKeywords;
      }
    }

    // Final safeguard: ensure searchQuery is valid
    console.log('[DEBUG] Final safeguard check - searchQuery:', searchQuery);
    console.log('[DEBUG] Final safeguard - type:', typeof searchQuery, 'length:', searchQuery?.trim()?.length);
    if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length < 2) {
      console.log('[DEBUG] EARLY EXIT: searchQuery invalid at final safeguard');
      return NextResponse.json({
        summary: null,
        commonGround: null,
        keyDifferences: null,
        alternatives: [],
        isPaywalled,
        needsKeywords: true,
        error: 'Could not generate a valid search query. Please enter keywords manually.',
        errorType: 'NEEDS_KEYWORDS',
        retryable: false,
      }, { headers: corsHeaders });
    }

    // 4. Check cache BEFORE incrementing usage (cache hits don't cost API calls)
    const cachedResult = getCachedResult(searchQuery);
    if (cachedResult) {
      console.log('[Cache] Returning cached result for:', searchQuery);
      return NextResponse.json({ ...cachedResult, cached: true }, { headers: corsHeaders });
    }

    // 5. Increment Usage (only for non-cached requests)
    const { info: usageInfo, cookieValue } = await incrementUsage(req);

    // 6. STEP 1: THE EYES - Search with Brave
    console.log(`[Search] Query: "${searchQuery}"`);
    const searchResults = await searchWithBrave(searchQuery);
    console.log(`[Search] Brave returned ${searchResults.length} results`);

    // Deduplicate by domain
    const seenDomains = new Set<string>();
    const deduped = searchResults.filter(result => {
      if (!result.domain || seenDomains.has(result.domain)) return false;
      seenDomains.add(result.domain);
      return true;
    });
    console.log(`[Search] After deduplication: ${deduped.length}`);

    // Filter out low-quality results (index pages, irrelevant content)
    let qualityFiltered = filterQualityResults(deduped, searchQuery);
    console.log(`[Search] After quality filter: ${qualityFiltered.length} of ${deduped.length} passed`);

    // FALLBACK: If quality filter returns 0 but we had results, retry with broader keywords
    if (qualityFiltered.length === 0 && searchResults.length > 0) {
      console.log(`[Fallback] Quality filter returned 0. Trying broader search...`);

      // Take first 3 keywords for broader search
      const words = searchQuery.split(/\s+/).filter(w => w.length > 2);
      const broaderQuery = words.slice(0, 3).join(' ');

      if (broaderQuery && broaderQuery !== searchQuery) {
        console.log(`[Fallback] Broader query: "${broaderQuery}"`);
        const fallbackResults = await searchWithBrave(broaderQuery);
        console.log(`[Fallback] Got ${fallbackResults.length} results`);

        // Use relaxed quality filter (only structural, skip relevance)
        qualityFiltered = fallbackResults.filter(result => {
          if (!result || !result.url) return false;
          try {
            const path = new URL(result.url).pathname;
            const segments = path.split('/').filter(s => s.length > 0);
            if (segments.length < 2) return false;
            if (path.endsWith('/') && segments.length < 3) return false;
            if (/\/(world|news|business|politics|tech|opinion)\/?$/.test(path)) return false;
            return true;
          } catch { return false; }
        });
        console.log(`[Fallback] After relaxed filter: ${qualityFiltered.length} passed`);
      }
    }

    // ==========================================================================
    // GAP FILL: Actively hunt for underrepresented political perspectives
    // ==========================================================================
    let gapFillAttempted = { right: false, left: false };
    let gapFillFound = { right: 0, left: 0 };

    // Count current political lean distribution
    const countPoliticalLean = (results: CSEResult[]) => {
      let rightCount = 0;
      let leftCount = 0;
      for (const r of results) {
        const lean = getPoliticalLean(r.domain || '');
        if (lean === 'right' || lean === 'center-right') rightCount++;
        else if (lean === 'left' || lean === 'center-left') leftCount++;
      }
      return { rightCount, leftCount };
    };

    const initialCounts = countPoliticalLean(qualityFiltered);
    console.log(`[GapFill] Initial counts - Right: ${initialCounts.rightCount}, Left: ${initialCounts.leftCount}`);

    // Gap fill for RIGHT-leaning sources if fewer than 2
    if (initialCounts.rightCount < 2 && qualityFiltered.length > 0) {
      gapFillAttempted.right = true;
      console.log(`[GapFill] Right sources underrepresented (${initialCounts.rightCount}). Running targeted search...`);

      const siteQuery = RIGHT_LEANING_DOMAINS.slice(0, 6).map(d => `site:${d}`).join(' OR ');
      const targetedQuery = `${searchQuery} (${siteQuery})`;

      try {
        const rightResults = await searchWithBrave(targetedQuery);
        console.log(`[GapFill] Right-targeted search returned ${rightResults.length} results`);

        // Filter and dedupe
        const existingUrls = new Set(qualityFiltered.map(r => r.url));
        const existingDomains = new Set(qualityFiltered.map(r => r.domain));
        const newRightResults = rightResults.filter(r =>
          !existingUrls.has(r.url) &&
          !existingDomains.has(r.domain) &&
          RIGHT_LEANING_DOMAINS.some(d => r.domain?.includes(d))
        );

        gapFillFound.right = newRightResults.length;
        console.log(`[GapFill] Adding ${newRightResults.length} new right-leaning sources`);
        qualityFiltered = [...qualityFiltered, ...newRightResults];
      } catch (err) {
        console.log(`[GapFill] Right-targeted search failed:`, err);
      }
    }

    // Gap fill for LEFT-leaning sources if fewer than 2
    if (initialCounts.leftCount < 2 && qualityFiltered.length > 0) {
      gapFillAttempted.left = true;
      console.log(`[GapFill] Left sources underrepresented (${initialCounts.leftCount}). Running targeted search...`);

      const siteQuery = LEFT_LEANING_DOMAINS.slice(0, 6).map(d => `site:${d}`).join(' OR ');
      const targetedQuery = `${searchQuery} (${siteQuery})`;

      try {
        const leftResults = await searchWithBrave(targetedQuery);
        console.log(`[GapFill] Left-targeted search returned ${leftResults.length} results`);

        // Filter and dedupe
        const existingUrls = new Set(qualityFiltered.map(r => r.url));
        const existingDomains = new Set(qualityFiltered.map(r => r.domain));
        const newLeftResults = leftResults.filter(r =>
          !existingUrls.has(r.url) &&
          !existingDomains.has(r.domain) &&
          LEFT_LEANING_DOMAINS.some(d => r.domain?.includes(d))
        );

        gapFillFound.left = newLeftResults.length;
        console.log(`[GapFill] Adding ${newLeftResults.length} new left-leaning sources`);
        qualityFiltered = [...qualityFiltered, ...newLeftResults];
      } catch (err) {
        console.log(`[GapFill] Left-targeted search failed:`, err);
      }
    }

    const finalCounts = countPoliticalLean(qualityFiltered);
    console.log(`[GapFill] Final counts - Right: ${finalCounts.rightCount}, Left: ${finalCounts.leftCount}`);

    // Diversify by source type using round-robin
    const diverseResults = diversifyResults(qualityFiltered, 15);
    console.log(`[Search] After diversity: ${diverseResults.length} results`);

    if (diverseResults.length === 0) {
      const response = NextResponse.json({
        summary: 'No coverage found on trusted news sources for this story. Try different keywords.',
        commonGround: null,
        keyDifferences: null,
        alternatives: [],
        isPaywalled,
        usage: usageInfo,
      }, { headers: corsHeaders });
      response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);
      return response;
    }

    // 6. STEP 2: THE BRAIN - Synthesize with Gemini
    console.log(`[Gemini] Synthesizing ${diverseResults.length} sources...`);
    const intelBrief = await synthesizeWithGemini(diverseResults, searchQuery);

    // 7. STEP 3: Process results with badges + transparency
    const alternatives = processSearchResults(diverseResults);

    // 8. Analyze political diversity + query bias (pass gap fill info for accurate warnings)
    const diversityAnalysis = analyzePoliticalDiversity(alternatives, {
      attempted: gapFillAttempted,
      found: gapFillFound,
    });
    const queryBiasWarning = detectQueryBias(searchQuery);
    console.log(`[Diversity] Left: ${diversityAnalysis.leftCount}, Center: ${diversityAnalysis.centerCount}, Right: ${diversityAnalysis.rightCount}, Balanced: ${diversityAnalysis.isBalanced}`);
    if (queryBiasWarning) console.log(`[QueryBias] Warning: ${queryBiasWarning}`);

    // 9. Handle Gemini timeout - return fallback response
    if (!intelBrief) {
      console.log('[Gemini] Timeout or error - returning fallback response');
      const response = NextResponse.json({
        summary: `Found **${alternatives.length} sources** covering this story. AI synthesis timed out - please review the sources below.`,
        commonGround: [{ label: 'Coverage', value: `${alternatives.length} sources found covering this topic.` }],
        keyDifferences: 'AI analysis unavailable due to timeout. Compare sources manually.',
        alternatives,
        isPaywalled,
        usage: usageInfo,
        diversityAnalysis: {
          isBalanced: diversityAnalysis.isBalanced,
          leftCount: diversityAnalysis.leftCount,
          centerCount: diversityAnalysis.centerCount,
          rightCount: diversityAnalysis.rightCount,
          warning: diversityAnalysis.warning,
        },
        queryBiasWarning,
        timedOut: true,
      }, { headers: corsHeaders });
      response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);
      return response;
    }

    console.log(`[Gemini] Synthesis complete`);

    // 10. Override consensus language if diversity warning OR query bias is triggered
    let finalKeyDifferences: KeyDifference[] | string = intelBrief.keyDifferences;
    if ((diversityAnalysis.warning || queryBiasWarning) && typeof finalKeyDifferences === 'string') {
      const consensusPhrases = ['consistent narrative', 'sources agree', 'consensus'];
      const kdLower = (finalKeyDifferences as string).toLowerCase();
      const hasConsensusLanguage = consensusPhrases.some(phrase => kdLower.includes(phrase));
      if (hasConsensusLanguage) {
        if (queryBiasWarning) {
          finalKeyDifferences = 'Sources using this framing present a consistent narrative. Other perspectives may use different framing.';
          console.log(`[QueryBias] Overrode consensus language due to opinion-laden query`);
        } else {
          finalKeyDifferences = 'Sources in this sample agree. Note: This sample may not include all political perspectives.';
          console.log(`[Diversity] Overrode consensus language due to imbalanced sources`);
        }
      }
    }

    // 11. Build Response
    const responseData = {
      summary: intelBrief.summary,
      commonGround: intelBrief.commonGround || null,
      keyDifferences: finalKeyDifferences || null,
      alternatives,
      isPaywalled,
      usage: usageInfo,
      diversityAnalysis: {
        isBalanced: diversityAnalysis.isBalanced,
        leftCount: diversityAnalysis.leftCount,
        centerCount: diversityAnalysis.centerCount,
        rightCount: diversityAnalysis.rightCount,
        warning: diversityAnalysis.warning,
      },
      queryBiasWarning,
    };

    // 12. Cache the result for future identical queries
    setCachedResult(searchQuery, responseData);

    const response = NextResponse.json(responseData, { headers: corsHeaders });
    response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);
    return response;

  } catch (error: any) {
    console.error('Error in /api/find:', error?.message || error);
    
    let appError: AppError;
    if (error.message?.includes('fetch failed') || error.message?.includes('ENOTFOUND')) {
      appError = createError('NETWORK_ERROR');
    } else if (error.message?.includes('timeout') || error.name === 'AbortError') {
      appError = createError('TIMEOUT');
    } else {
      appError = createError('API_ERROR');
    }
    
    return NextResponse.json(
      { error: appError.userMessage, errorType: appError.type, retryable: appError.retryable },
      { status: appError.statusCode, headers: corsHeaders }
    );
  }
}