export const QUEUE_HOLD_MS = 400;
export const QUEUE_REVEAL = 88;
export function queueIntent(
  dx: number,
  dy: number,
): "pending" | "swipe" | "scroll" {
  if (Math.hypot(dx, dy) < 10) return "pending";
  return Math.abs(dx) > Math.abs(dy) * 1.4 ? "swipe" : "scroll";
}
/** A swipe only reveals an action; removal always requires a separate click. */
export function queueRelease(offset: number): "open" | "close" {
  return offset <= -36 ? "open" : "close";
}
