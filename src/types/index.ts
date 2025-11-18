// This is the structure for the Grounding Sources
export interface GroundingSource {
  uri: string;
  title: string;
}

// This is the old structure. We'll keep it for reference
// but GroundingSource is what we use now.
export interface AiResult {
  url: string;
  title: string;
  source: string;
  summary: string;
}