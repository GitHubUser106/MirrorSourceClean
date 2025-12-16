// =============================================================================
// types.ts - MirrorSource 3.0
// =============================================================================

// Ownership structure types
export type OwnershipType = 
  | 'private' 
  | 'public_traded' 
  | 'nonprofit' 
  | 'public_media' 
  | 'state_owned' 
  | 'cooperative' 
  | 'trust';

export interface OwnershipInfo {
  owner: string;
  parent?: string;
  type: OwnershipType;
  note?: string;
}

export interface FundingInfo {
  model: string;
  note?: string;
}

// Source type from the API
export type SourceType = 
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
  | 'platform';

// Main source interface returned from the API
export interface GroundingSource {
  uri: string;
  title: string;
  snippet: string;
  displayName: string;
  sourceDomain: string;
  sourceType: SourceType;
  countryCode: string;
  isSyndicated: boolean;
  // NEW in 3.0 - Transparency data
  ownership?: OwnershipInfo;
  funding?: FundingInfo;
}

// API Response structure
export interface FindResponse {
  summary: string | null;
  commonGround: string | null;
  keyDifferences: string | null;
  alternatives: GroundingSource[];
  isPaywalled: boolean;
  usage?: {
    used: number;
    remaining: number;
    limit: number;
    resetAt: string;
  };
  needsKeywords?: boolean;
  error?: string;
  errorType?: string;
  retryable?: boolean;
}