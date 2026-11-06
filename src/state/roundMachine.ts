import { copy } from "../copy/zh-CN";
import {
  deriveSequential,
  sequentialMaxStart,
  CONTINUE_ERROR,
} from "./sequential";
import type { SegmentMode } from "./segmentModes";
import type { RoundPhase, Segment } from "../types/round";
export interface Schedule {
  start: number;
  a: number;
  b: number;
  transitionEnd: number;
  judging: number;
  offset: number;
  v1?: boolean;
  sequential?: boolean;
  bEnd?: number;
  aEnd?: number;
  bOffset?: number;
  bPerformance?: number;
}
export function makeSchedule(
  now: number,
  segment: Segment,
  transition: number,
): Schedule {
  const offset = Math.max(0, segment.segmentStart - segment.preRoll);
  const start = now + 0.06;
  const a = start + segment.segmentStart - offset;
  const b = a + segment.segmentEnd - segment.segmentStart;
  return {
    start,
    a,
    b,
    transitionEnd: b + transition,
    judging: b + segment.segmentEnd - segment.segmentStart,
    offset,
  };
}
export function phaseAt(time: number, s: Schedule): RoundPhase {
  if (s.v1) {
    if (time < s.a) return "PRE_A";
    if (time < s.b) return "DANCER_A";
    if (time < Math.min(s.transitionEnd, s.bPerformance!)) return "TRANSITION";
    if (time < s.bPerformance!) return "PRE_B";
    if (time < (s.bEnd ?? s.judging)) return "DANCER_B";
    if (time < s.judging) return "POST_B";
    return "JUDGING";
  }
  if (time < s.a) return "PRE";
  if (time < s.b) return "DANCER_A";
  if (time < s.transitionEnd) return "TRANSITION";
  if (time < s.judging) return "DANCER_B";
  return "JUDGING";
}

export interface PlaybackOptions {
  scratch?: boolean;
  mode?: SegmentMode;
  postRoll?: number;
  segmentB?: { start: number; end: number };
  analysis?: { bpm: number; beats: number[]; downbeats: number[] };
}
/** V1 extends the legacy schedule; b is the incoming voice start, not B's performance start. */
export function makeLiveSchedule(
  now: number,
  segment: Segment,
  duration: number,
  options: PlaybackOptions,
): Schedule {
  const length = segment.segmentEnd - segment.segmentStart;
  if (options.mode === "sequential") {
    const post = options.postRoll ?? 5;
    if (
      !Number.isFinite(post) ||
      post < 0 ||
      segment.segmentStart >
        sequentialMaxStart(duration, length, segment.preRoll, post) + 1e-6
    )
      throw new Error(CONTINUE_ERROR);
    const flow = deriveSequential(
      segment.segmentStart,
      length,
      segment.preRoll,
      post,
    );
    const offset = flow.preStart,
      start = now + 0.06;
    const clock = (position: number) => start + position - offset;
    return {
      start,
      offset,
      a: clock(flow.a.start),
      aEnd: clock(flow.a.end),
      b: clock(flow.bPreStart),
      bOffset: flow.bPreStart,
      bPerformance: clock(flow.b.start),
      bEnd: clock(flow.b.end),
      transitionEnd: clock(flow.bPreStart),
      judging: clock(flow.postEnd),
      v1: true,
      sequential: true,
    };
  }
  const incoming = options.segmentB ?? {
    start: segment.segmentStart,
    end: segment.segmentEnd,
  };
  if (
    ![incoming.start, incoming.end].every(Number.isFinite) ||
    incoming.start < 0 ||
    incoming.end > duration ||
    Math.abs(incoming.end - incoming.start - length) > 0.001
  )
    throw new Error(copy["A / B 片段必须等长且位于歌曲内。"]);
  const nominal = Math.max(0, incoming.start - segment.preRoll);
  const analysis = options.analysis;
  const beats = (analysis?.beats ?? [])
    .filter((x) => Number.isFinite(x) && x >= 0 && x <= duration)
    .sort((a, b) => a - b);
  const downbeats = (analysis?.downbeats ?? []).filter(
    (x) => Number.isFinite(x) && x >= 0 && x <= duration,
  );
  const aware =
    !!analysis &&
    analysis.bpm >= 30 &&
    analysis.bpm <= 300 &&
    beats.length >= 2;
  const nearest = (points: number[]) =>
    points
      .filter((x) => x <= incoming.start && Math.abs(x - nominal) <= 0.25)
      .sort((a, b) => Math.abs(a - nominal) - Math.abs(b - nominal))[0];
  const bOffset = aware
    ? (nearest(downbeats) ?? nearest(beats) ?? nominal)
    : nominal;
  const offset = Math.max(0, segment.segmentStart - segment.preRoll),
    start = now + 0.06,
    a = start + segment.segmentStart - offset,
    aEnd = a + length;
  // Never shorten A. A short post-segment tail may align the handover to a beat.
  const nextBeat = aware
    ? beats.find(
        (x) =>
          x >= segment.segmentEnd &&
          x - segment.segmentEnd <= 0.25 &&
          x < duration - 0.02,
      )
    : undefined;
  const delay = nextBeat === undefined ? 0 : nextBeat - segment.segmentEnd;
  const b = aEnd + delay,
    bPerformance = b + incoming.start - bOffset;
  const fade = Math.min(
    aware ? Math.max(0.3, Math.min(1.5, 60 / analysis!.bpm)) : 0.5,
    (incoming.start - bOffset + length) / 2,
  );
  return {
    start,
    a,
    b,
    offset,
    aEnd,
    bOffset,
    bPerformance,
    transitionEnd: b + fade,
    judging: bPerformance + length,
    v1: true,
  };
}
export function remainingAt(now: number, s: Schedule): number | undefined {
  const phase = phaseAt(now, s);
  const end =
    phase === "PRE" || phase === "PRE_A"
      ? s.a
      : phase === "DANCER_A"
        ? (s.aEnd ?? s.b)
        : phase === "TRANSITION" || phase === "PRE_B"
          ? (s.bPerformance ?? s.transitionEnd)
          : phase === "DANCER_B"
            ? (s.bEnd ?? s.judging)
            : phase === "POST_B"
              ? s.judging
              : undefined;
  return end === undefined
    ? undefined
    : Math.max(0, end - Math.max(now, s.start));
}
