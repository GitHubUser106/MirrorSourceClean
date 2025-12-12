export type SourceType = 'wire' | 'national' | 'international' | 'local' | 'public' | 'corporate' | 'state' | 'magazine' | 'specialized' | 'analysis' | 'reference' | 'syndication' | 'archive' | 'platform';

export interface GroundingSource {
  uri: string;
  title: string;
  displayName?: string;
  sourceDomain?: string;
  sourceType?: SourceType;
  countryCode?: string;  // <-- ADD THIS
  isSyndicated?: boolean;
}

export interface ArchiveResult {
  found: boolean;
  url?: string;
  source: 'wayback' | 'archive.today';
  timestamp?: string;
}

export interface SearchResponse {
  summary: string;
  alternatives: GroundingSource[];
  archives: ArchiveResult[];
  isPaywalled: boolean;
  usage: {
    used: number;
    limit: number;
    remaining: number;
    resetAt: string;
  };
}