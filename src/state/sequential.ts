import { copy } from "../copy/zh-CN";
import type { SegmentMode } from "./segmentModes";
export const DEFAULT_POST_ROLL = 5;
export const CONTINUE_ERROR =
  copy["Not enough music remaining for Continue mode."];
export function modeDefaults(record: {
  mode?: SegmentMode;
  postRoll?: number;
}) {
  return {
    mode: record.mode ?? "same",
    postRoll: record.postRoll ?? DEFAULT_POST_ROLL,
  };
}
export function sequentialMaxStart(
  duration: number,
  length: number,
  preRoll = 5,
  postRoll = DEFAULT_POST_ROLL,
) {
  return duration - 2 * length - preRoll - postRoll;
}
export function deriveSequential(
  start: number,
  length: number,
  preRoll = 5,
  postRoll = DEFAULT_POST_ROLL,
) {
  const a = { start, end: start + length };
  const b = { start: a.end + preRoll, end: a.end + preRoll + length };
  return {
    a,
    b,
    preStart: Math.max(0, start - preRoll),
    bPreStart: a.end,
    postEnd: b.end + postRoll,
  };
}
export function clampSequential(
  start: number,
  length: number,
  duration: number,
  preRoll = 5,
  postRoll = DEFAULT_POST_ROLL,
) {
  const max = sequentialMaxStart(duration, length, preRoll, postRoll);
  if (
    ![start, length, duration, preRoll, postRoll].every(Number.isFinite) ||
    length < 0.5 ||
    preRoll < 0 ||
    postRoll < 0 ||
    max < 0
  )
    throw new Error(CONTINUE_ERROR);
  return deriveSequential(
    Math.max(0, Math.min(start, max)),
    length,
    preRoll,
    postRoll,
  );
}
