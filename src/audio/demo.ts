// A deterministic full-length test signal, not a downloaded song or detected beat.
export function demoBuffer(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 32, ctx.sampleRate),
    data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate,
      beat = t % 0.5,
      hat = t % 0.25;
    const freq = [110, 130.81, 146.83, 98][Math.floor(t / 2) % 4];
    data[i] =
      0.22 *
        Math.sin(2 * Math.PI * (48 * beat + 3 * (1 - Math.exp(-30 * beat)))) *
        Math.exp(-15 * beat) +
      0.1 * Math.sin(2 * Math.PI * freq * t) * Math.exp(-4 * beat) +
      0.035 * Math.sin(i * 1.738) * Math.exp(-70 * hat);
  }
  return buffer;
}
