import { copy } from "../copy/zh-CN";
export interface Selection {
  start: number;
  end: number;
}
export interface Viewport {
  start: number;
  end: number;
}
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export function durationError(value: string, trackDuration: number): string {
  if (value.trim() === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0.5)
    return copy["Round Duration 至少为 0.5 秒。"];
  if (n > trackDuration) return copy["Round Duration 不能超过歌曲总时长。"];
  return "";
}
export function lockDuration(
  selection: Selection,
  length: number,
  trackDuration: number,
): Selection {
  if (!Number.isFinite(length) || length < 0.5 || length > trackDuration)
    throw new Error(copy["Invalid round duration"]);
  const start = clamp(selection.start, 0, trackDuration - length);
  return { start, end: start + length };
}
export function moveBoundary(
  selection: Selection,
  edge: "start" | "end",
  value: number,
  trackDuration: number,
  length?: number,
): Selection {
  if (!Number.isFinite(value)) return selection;
  if (length !== undefined) {
    const start = clamp(
      edge === "start" ? value : value - length,
      0,
      trackDuration - length,
    );
    return { start, end: start + length };
  }
  return edge === "start"
    ? { start: clamp(value, 0, selection.end - 0.5), end: selection.end }
    : {
        start: selection.start,
        end: clamp(value, selection.start + 0.5, trackDuration),
      };
}
export function focusedViewport(
  selection: Selection,
  duration: number,
): Viewport {
  return {
    start: Math.max(0, selection.start - 10),
    end: Math.min(duration, selection.end + 10),
  };
}
export function previewRange(
  kind: "start" | "end",
  selection: Selection,
  duration: number,
  preRoll = 5,
): Viewport {
  return kind === "start"
    ? {
        start: Math.max(0, selection.start - preRoll),
        end: Math.min(duration, selection.start + 5),
      }
    : {
        start: Math.max(0, selection.end - 5),
        end: Math.min(duration, selection.end + 5),
      };
}
export function positionFromDrag(
  position: number,
  deltaX: number,
  width: number,
  viewport: Viewport,
) {
  return clamp(
    position + (deltaX / Math.max(1, width)) * (viewport.end - viewport.start),
    viewport.start,
    viewport.end,
  );
}
