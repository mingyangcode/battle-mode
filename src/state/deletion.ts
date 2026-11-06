import type { Track } from "../types/track";
export const UNDO_MILLISECONDS = 5000;
export function withoutTrack(tracks: Track[], id: string) {
  return tracks.filter((t) => t.id !== id);
}
export function restoreTrack(tracks: Track[], track: Track, index: number) {
  if (tracks.some((t) => t.id === track.id)) return tracks;
  const next = [...tracks];
  next.splice(Math.min(index, next.length), 0, track);
  return next;
}
export function swipeOutcome(dx: number, width: number) {
  return dx <= -Math.min(220, width * 0.45)
    ? "delete"
    : dx <= -32
      ? "open"
      : "closed";
}
