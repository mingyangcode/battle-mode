export const JUDGING_LOOP_FADE = 0.5;
export const JUDGING_LOOKAHEAD_LOOPS = 4;
export function judgingLoopPlan(
  fileEnd: number,
  judging: number,
  duration: number,
) {
  const fade = Math.min(JUDGING_LOOP_FADE, duration / 4);
  const first = Math.max(judging, fileEnd - fade);
  return {
    first,
    period: duration - fade,
    fade,
    firstFade: Math.max(0.015, Math.min(fade, fileEnd - first)),
  };
}
export function judgingLoopPosition(
  now: number,
  first: number,
  period: number,
) {
  return now < first ? undefined : (((now - first) % period) + period) % period;
}
