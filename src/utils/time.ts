export function time(value: number, precise = false) {
  const ticks = Math.floor((Math.max(0, value || 0) + 1e-7) * 10);
  return `${Math.floor(ticks / 600)
    .toString()
    .padStart(2, "0")}:${Math.floor((ticks / 10) % 60)
    .toString()
    .padStart(2, "0")}${precise ? "." + (ticks % 10) : ""}`;
}
export function peaks(buffer: AudioBuffer, count = 180) {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    let max = 0;
    const from = Math.floor((i * buffer.length) / count),
      to = Math.floor(((i + 1) * buffer.length) / count);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (
        let j = from;
        j < to;
        j += Math.max(1, Math.floor((to - from) / 200))
      )
        max = Math.max(max, Math.abs(data[j]));
    }
    result.push(max);
  }
  const max = Math.max(...result, 0.001);
  return result.map((x) => x / max);
}
