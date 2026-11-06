/** Original procedural vinyl-like gesture. No sampled recording or third-party asset. */
export const SCRATCH_DURATION = 0.35;
export const SCRATCH_LEAD = 0.1;
export const SCRATCH_GAIN = 0.12;
export const TRANSITION_HEADROOM = 0.65;
export function scratchSamples(rate: number) {
  const out = new Float32Array(Math.round(rate * SCRATCH_DURATION));
  let seed = 731,
    phase = 0,
    filtered = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate,
      u = t / SCRATCH_DURATION;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    const gesture = Math.sin(Math.PI * 4 * u);
    phase += (2 * Math.PI * (400 + 1700 * Math.abs(gesture))) / rate;
    filtered = 0.65 * filtered + 0.35 * noise;
    const envelope = Math.sin(Math.PI * u) ** 2;
    out[i] = envelope * (0.55 * filtered + 0.3 * Math.sin(phase) * gesture);
  }
  return out;
}
export function scratchBuffer(ctx: BaseAudioContext) {
  const samples = scratchSamples(ctx.sampleRate);
  const b = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  b.copyToChannel(samples, 0);
  return b;
}
