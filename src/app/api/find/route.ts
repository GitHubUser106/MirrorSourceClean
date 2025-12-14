import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage, COOKIE_OPTIONS } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

// =============================================================================
// SOURCE CLASSIFICATION WITH TRANSPARENCY DATA
// =============================================================================

type SourceType = 'wire' | 'public' | 'corporate' | 'state' | 'analysis' | 'local' | 'national' | 'international' | 'magazine' | 'specialized' | 'reference' | 'syndication' | 'platform';

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

interface SourceInfo {
  displayName: string;
  type: SourceType;
  countryCode: string;
  ownership?: OwnershipInfo;
  funding?: FundingInfo;
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
  },
  'reuters.com': {
    displayName: 'REUTERS',
    type: 'wire',
    countryCode: 'UK',
    ownership: { owner: 'Thomson Reuters Corporation', type: 'public_traded', note: 'NYSE (TRI) and TSX. Thomson family holds ~65% voting control' },
    funding: { model: 'Financial data terminals, news licensing & professional services' },
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
    type: 'public',
    countryCode: 'US',
    ownership: { owner: 'National Public Radio, Inc.', type: 'nonprofit', note: '501(c)(3) non-profit media organization founded 1970' },
    funding: { model: 'Member station fees, corporate sponsors, foundations & individual donors', note: 'Federal funding via CPB is <1% of total budget' },
  },
  'pbs.org': {
    displayName: 'PBS',
    type: 'public',
    countryCode: 'US',
    ownership: { owner: 'Public Broadcasting Service', type: 'nonprofit', note: 'Non-profit public broadcaster; member organization of 350+ local stations' },
    funding: { model: 'Member stations, corporate underwriting, foundations & viewer donations' },
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
    type: 'public',
    countryCode: 'UK',
    ownership: { owner: 'British Broadcasting Corporation', type: 'public_media', note: 'UK public corporation established by Royal Charter; governed by BBC Board' },
    funding: { model: 'UK TV license fee (£159/year) & BBC Studios commercial revenue' },
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
    displayName: 'AL JAZEERA',
    type: 'international',
    countryCode: 'QA',
    ownership: { owner: 'Al Jazeera Media Network', type: 'state_owned', note: 'Funded by the government of Qatar; headquartered in Doha' },
    funding: { model: 'Qatar government funding (estimated $500M+ annually)' },
  },
  'theguardian.com': {
    displayName: 'THE GUARDIAN',
    type: 'international',
    countryCode: 'UK',
    ownership: { owner: 'Guardian Media Group', parent: 'Scott Trust Limited', type: 'trust', note: 'Trust structure (since 1936) ensures editorial independence in perpetuity' },
    funding: { model: 'Reader contributions, advertising, events & Guardian Foundation grants', note: 'No paywall; relies on voluntary reader support (~1M+ paying supporters)' },
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
  },
  'foxnews.com': {
    displayName: 'FOX NEWS',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'Fox Corporation', type: 'public_traded', note: 'NASDAQ (FOXA/FOX). Murdoch family controls ~40% voting power via Family Trust' },
    funding: { model: 'Advertising & cable carriage fees (most profitable cable news network)' },
  },
  'nbcnews.com': {
    displayName: 'NBC NEWS',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'NBCUniversal News Group', parent: 'Comcast Corporation', type: 'public_traded', note: 'Comcast trades on NASDAQ (CMCSA). Largest cable company in US' },
    funding: { model: 'Advertising, cable fees & Peacock streaming' },
  },
  'cbsnews.com': {
    displayName: 'CBS NEWS',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'CBS News and Stations', parent: 'Paramount Global', type: 'public_traded', note: 'Paramount trades NASDAQ (PARA). Shari Redstone controls via National Amusements' },
    funding: { model: 'Advertising, affiliate fees & Paramount+ streaming' },
  },
  'abcnews.go.com': {
    displayName: 'ABC NEWS',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'ABC News', parent: 'The Walt Disney Company', type: 'public_traded', note: 'Disney trades on NYSE (DIS). ABC acquired by Disney in 1996' },
    funding: { model: 'Advertising, affiliate fees & Disney+ streaming' },
  },
  'msnbc.com': {
    displayName: 'MSNBC',
    type: 'corporate',
    countryCode: 'US',
    ownership: { owner: 'NBCUniversal News Group', parent: 'Comcast Corporation', type: 'public_traded', note: 'Comcast trades NASDAQ (CMCSA). Originally NBC-Microsoft joint venture (1996)' },
    funding: { model: 'Advertising & cable carriage fees' },
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
  },
  'axios.com': {
    displayName: 'AXIOS',
    type: 'national',
    countryCode: 'US',
    ownership: { owner: 'Axios Media', parent: 'Cox Enterprises', type: 'private', note: 'Cox Enterprises acquired Axios in 2022 for $525M. Founded by Politico alumni' },
    funding: { model: 'Newsletters, advertising & Axios Pro subscriptions' },
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
    displayName: 'THE TELEGRAPH',
    type: 'national',
    countryCode: 'UK',
    ownership: { owner: 'RedBird IMI', type: 'private', note: 'UAE-backed consortium bid approved 2024; previously Barclay family (since 2004)' },
    funding: { model: 'Subscriptions (primary) & advertising' },
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
  // ANALYSIS / THINK TANKS
  // ===========================================================================
  'thehill.com': {
    displayName: 'THE HILL',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Nexstar Media Group', type: 'public_traded', note: 'NASDAQ (NXST). Nexstar acquired The Hill in 2021 for $130M' },
    funding: { model: 'Advertising & events' },
  },
  'politico.com': {
    displayName: 'POLITICO',
    type: 'analysis',
    countryCode: 'US',
    ownership: { owner: 'Axel Springer SE', type: 'private', note: 'German media conglomerate acquired Politico in 2021 for ~$1B. KKR is investor' },
    funding: { model: 'Advertising, Politico Pro subscriptions & events' },
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
  },
  'theatlantic.com': {
    displayName: 'THE ATLANTIC',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'The Atlantic Monthly Group', parent: 'Emerson Collective (Laurene Powell Jobs)', type: 'private', note: 'Steve Jobs\' widow acquired majority stake in 2017' },
    funding: { model: 'Subscriptions, advertising & events (Atlantic Festival)' },
  },
  'newyorker.com': {
    displayName: 'THE NEW YORKER',
    type: 'magazine',
    countryCode: 'US',
    ownership: { owner: 'The New Yorker', parent: 'Condé Nast (Advance Publications)', type: 'private', note: 'Advance owned by Newhouse family since 1985' },
    funding: { model: 'Subscriptions & advertising' },
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
  },
  'cnbc.com': {
    displayName: 'CNBC',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'NBCUniversal', parent: 'Comcast Corporation', type: 'public_traded', note: 'NASDAQ (CMCSA). Business & financial news network' },
    funding: { model: 'Advertising, cable carriage fees & CNBC Pro subscriptions' },
  },
  'ft.com': {
    displayName: 'FINANCIAL TIMES',
    type: 'specialized',
    countryCode: 'UK',
    ownership: { owner: 'Nikkei, Inc.', type: 'private', note: 'Japanese media company acquired FT from Pearson in 2015 for $1.3B' },
    funding: { model: 'Subscriptions (1M+ paying readers) & advertising' },
  },
  'wsj.com': {
    displayName: 'WALL STREET JOURNAL',
    type: 'specialized',
    countryCode: 'US',
    ownership: { owner: 'Dow Jones & Company', parent: 'News Corp (Murdoch family)', type: 'public_traded', note: 'News Corp trades NASDAQ (NWSA). Largest US newspaper by circulation' },
    funding: { model: 'Subscriptions (3M+) & advertising' },
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
};

// Get source info with transparency data
function getSourceInfo(domain: string): SourceInfo {
  if (!domain) return { displayName: 'SOURCE', type: 'local', countryCode: 'US' };
  const lower = domain.toLowerCase();
  
  // Check exact matches first
  for (const [key, info] of Object.entries(sources)) {
    if (lower.includes(key)) return info;
  }
  
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
  return { displayName: parts[0].toUpperCase(), type, countryCode };
}

// --- URL to Keywords Extraction ---
function extractKeywordsFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    const words = path
      .split(/[\/\-_.]/)
      .filter(segment => segment.length > 2)
      .filter(segment => !/^[0-9a-f]+$/i.test(segment))
      .filter(segment => !/^\d+$/.test(segment))
      .filter(segment => /[a-z]/i.test(segment))
      .filter(segment => !/^(content|article|story|news|post|index|html|htm|php|aspx|world|us|uk|business|tech|opinion|markets|amp|www|com|org|net)$/i.test(segment));
    
    if (words.length < 2) return null;
    return words.slice(0, 8).join(' ');
  } catch { return null; }
}

// --- Helpers ---
function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

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
}

async function searchWithCSE(query: string): Promise<CSEResult[]> {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    console.error('Missing CSE credentials');
    throw new Error('Search configuration error');
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=10`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('CSE API error:', response.status, errorData);
      throw new Error(`CSE API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) return [];

    return data.items.map((item: any) => {
      let domain = '';
      try { domain = new URL(item.link).hostname.replace(/^www\./, ''); } catch {}
      
      return {
        url: item.link,
        title: decodeHtmlEntities(item.title || ''),
        snippet: decodeHtmlEntities(item.snippet || ''),
        domain,
      };
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('Search timeout');
    throw error;
  }
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

async function synthesizeWithGemini(searchResults: CSEResult[], originalQuery: string): Promise<IntelBrief> {
  const context = searchResults.map((r, i) => 
    `[Source ${i + 1}: ${r.domain}]\nTitle: ${r.title}\nSnippet: ${r.snippet}`
  ).join('\n\n');

  const prompt = `
You are a news intelligence analyst. Based ONLY on the sources provided below, write a brief analysis.

STORY: "${originalQuery}"

SOURCES:
${context}

RESPOND IN JSON FORMAT:
{
  "summary": "3-4 sentences summarizing the story. Grade 6-8 reading level. Bold only the KEY TAKEAWAY of each sentence using **bold** syntax. Max 4 bold phrases.",
  "commonGround": [{"label": "Short category", "value": "What sources agree on"}, ...],
  "keyDifferences": [{"label": "Topic", "value": "How sources differ"}, ...] OR "Sources present a consistent narrative on this story."
}

RULES:
- ONLY use information from the sources above
- NEVER use generic references like "Source 1" or "Source 2". Always use the actual publisher name (e.g., "Reuters", "BBC", "Al Jazeera")
- commonGround must be an array of 2-4 fact objects with "label" (1-3 words, e.g., "Location", "When", "Who") and "value" (the agreed-upon fact)
- keyDifferences: If sources DISAGREE, return an array of 1-3 difference objects with "label" (topic of disagreement, e.g., "Cause", "Blame", "Timeline") and "value" (the contrasting interpretations with **bolded publisher names**, e.g., "**Reuters** reports X, while **CNN** claims Y"). If sources AGREE, return a simple string like "Sources present a consistent narrative on this story."
- Bold key conclusions in summary only
- Use simple language
`.trim();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const geminiResponse: any = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    clearTimeout(timeoutId);

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
    clearTimeout(timeoutId);
    console.error('Gemini synthesis error:', error?.message);
    return {
      summary: `We found **${searchResults.length} sources** covering this story. Click any source below to read their coverage.`,
      commonGround: [],
      keyDifferences: '',
    };
  }
}

// =============================================================================
// STEP 3: PROCESS RESULTS - Apply badges, transparency, and sort
// =============================================================================
interface ProcessedSource {
  uri: string;
  title: string;
  displayName: string;
  sourceDomain: string;
  sourceType: SourceType;
  countryCode: string;
  isSyndicated: boolean;
  // NEW: Transparency data
  ownership?: OwnershipInfo;
  funding?: FundingInfo;
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
      displayName: sourceInfo.displayName,
      sourceDomain: result.domain,
      sourceType: sourceInfo.type,
      countryCode: sourceInfo.countryCode,
      isSyndicated: false,
      // Include transparency data
      ownership: sourceInfo.ownership,
      funding: sourceInfo.funding,
    });
  }

  // Sort by source type priority
  const typePriority: Record<SourceType, number> = {
    'wire': 0,
    'specialized': 1,
    'national': 2,
    'international': 3,
    'public': 4,
    'analysis': 5,
    'corporate': 6,
    'syndication': 7,
    'magazine': 8,
    'local': 9,
    'state': 10,
    'reference': 11,
    'platform': 12,
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
      
      const extractedKeywords = extractKeywordsFromUrl(url);
      
      if (!extractedKeywords) {
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
      
      searchQuery = extractedKeywords;
    }

    // 4. Increment Usage
    const { info: usageInfo, cookieValue } = await incrementUsage(req);

    // 5. STEP 1: THE EYES - Search with CSE
    console.log(`[CSE] Searching for: "${searchQuery}"`);
    const cseResults = await searchWithCSE(searchQuery);
    console.log(`[CSE] Found ${cseResults.length} results`);

    if (cseResults.length === 0) {
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
    console.log(`[Gemini] Synthesizing ${cseResults.length} sources...`);
    const intelBrief = await synthesizeWithGemini(cseResults, searchQuery);
    console.log(`[Gemini] Synthesis complete`);

    // 7. STEP 3: Process results with badges + transparency
    const alternatives = processSearchResults(cseResults);

    // 8. Build Response
    const response = NextResponse.json({
      summary: intelBrief.summary,
      commonGround: intelBrief.commonGround || null,
      keyDifferences: intelBrief.keyDifferences || null,
      alternatives,
      isPaywalled,
      usage: usageInfo,
    }, { headers: corsHeaders });

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