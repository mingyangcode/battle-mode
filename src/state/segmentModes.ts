import { copy } from "../copy/zh-CN";
import type {
  SegmentRange,
  MatchedSegmentRecommendation,
} from "../types/analysis";
export type SegmentMode = "same" | "matched" | "sequential";
export function validRange(r: SegmentRange, duration: number, length?: number) {
  return (
    Number.isFinite(r.start) &&
    Number.isFinite(r.end) &&
    r.start >= 0 &&
    r.end <= duration + 0.001 &&
    r.end - r.start >= 0.5 &&
    (length === undefined || Math.abs(r.end - r.start - length) < 0.001)
  );
}
export function applyRecommendation(
  r: SegmentRange,
  duration: number,
  length: number,
): SegmentRange {
  if (!validRange(r, duration, length))
    throw new Error(copy["推荐时间无效，请重新分析或手动编辑。"]);
  return {
    start: Math.min(r.start, duration - length),
    end: Math.min(r.start, duration - length) + length,
  };
}
export function applyPair(
  p: MatchedSegmentRecommendation,
  duration: number,
  length: number,
) {
  const a = applyRecommendation(p.segmentA, duration, length),
    b = applyRecommendation(p.segmentB, duration, length);
  if (Math.abs(a.start - b.start) < 0.001)
    throw new Error(copy["Matched Segments 需要两个不同片段。"]);
  return { a, b };
}
