export const TRANSITION_SECONDS = 0.5;
export const JUDGING_FADE_SECONDS = 1.1;
export const END_FADE_SECONDS = 0.5;
export function powerCurve(incoming: boolean) {
  return Float32Array.from({ length: 128 }, (_, i) =>
    incoming
      ? Math.sin(((i / 127) * Math.PI) / 2)
      : Math.cos(((i / 127) * Math.PI) / 2),
  );
}
