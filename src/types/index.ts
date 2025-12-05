export type SourceType = 'wire' | 'national' | 'international' | 'local' | 'public' | 'magazine' | 'reference' | 'syndication' | 'archive';

export interface GroundingSource {
  uri: string;
  title: string;
  displayName?: string;
  sourceDomain?: string;
  sourceType?: SourceType;
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