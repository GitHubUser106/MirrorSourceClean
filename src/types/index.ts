export type SourceType = 'wire' | 'national' | 'international' | 'local' | 'public' | 'magazine' | 'reference';

export interface GroundingSource {
  uri: string;
  title: string;
  displayName?: string;
  sourceDomain?: string;
  sourceType?: SourceType;
}