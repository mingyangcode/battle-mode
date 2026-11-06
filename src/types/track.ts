import type { AnalysisResult, SegmentRange } from "./analysis";
import type { SegmentMode } from "../state/segmentModes";
export interface Track {
  id: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  audioUrl?: string;
  file?: File;
  duration: number;
  segmentStart?: number;
  segmentEnd?: number;
  preRoll: number;
  /** Optional V1 editor lock; undefined preserves V0 free-length editing. */
  roundDuration?: number;
  mode?: SegmentMode;
  postRoll?: number;
  segmentB?: SegmentRange;
  analysis?: AnalysisResult;
  waveformPeaks?: number[];
  isPrepared: boolean;
  playedCount: number;
}
