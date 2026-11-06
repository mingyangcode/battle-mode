export const PAGE_SWIPE_IGNORE =
  'button,a,input,select,textarea,[role="slider"],dialog,.swipe-track,.track-row,.queue-panel,.queue-item,.wave,.timeline,[data-page-swipe-ignore]';
export function swipeDestination(
  page: "music" | "live",
  dx: number,
  dy: number,
) {
  if (Math.abs(dx) < 64 || Math.abs(dx) <= Math.abs(dy) * 1.4) return undefined;
  return page === "music" && dx < 0
    ? "live"
    : page === "live" && dx > 0
      ? "music"
      : undefined;
}
