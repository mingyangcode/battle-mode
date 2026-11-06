export interface SegmentRange {
  start: number;
  end: number;
}
export interface SegmentRecommendation extends SegmentRange {
  score: number;
}
export interface MatchedSegmentRecommendation {
  segmentA: SegmentRange;
  segmentB: SegmentRange;
  score: number;
}
export interface AnalysisResult {
  recommendationMode?: "same" | "matched" | "sequential";
  preRoll?: number;
  postRoll?: number;
  quality?: "quick" | "deep";
  elapsedSeconds?: number;
  trackHash: string;
  analysisVersion: string;
  recommendationVersion: string;
  roundDuration: number;
  duration: number;
  bpm: number;
  beats: number[];
  downbeats: number[];
  sections: { start: number; end: number; label: string }[];
  recommendations: SegmentRecommendation[];
  matchedPairs: MatchedSegmentRecommendation[];
  analyzer: string;
  cacheHit: boolean;
  rawCacheHit: boolean;
  warnings: string[];
}
