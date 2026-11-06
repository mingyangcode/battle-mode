import { AudioEngine } from "../src/audio/AudioEngine";
import { SCRATCH_DURATION, SCRATCH_LEAD } from "../src/audio/scratch";
export async function run() {
  const results: string[] = [];
  const assert = (condition: boolean, label: string) => {
    if (!condition) throw new Error(label);
    results.push(label);
  };
  const ctx = new OfflineAudioContext(1, 48000 * 5, 48000),
    engine = new AudioEngine();
  const internal = engine as unknown as {
    context: BaseAudioContext;
    master: GainNode;
    voices: AudioBufferSourceNode[];
  };
  internal.context = ctx;
  internal.master = ctx.createGain();
  internal.master.connect(ctx.destination);
  engine.resume = async () => {};
  const starts: { when: number; duration: number }[] = [];
  const create = ctx.createBufferSource.bind(ctx);
  ctx.createBufferSource = () => {
    const source = create(),
      start = source.start.bind(source);
    source.start = (when = 0, offset = 0, duration?: number) => {
      starts.push({ when, duration: source.buffer!.duration });
      if (duration === undefined) start(when, offset);
      else start(when, offset, duration);
    };
    return source;
  };
  const b = ctx.createBuffer(1, 48000 * 8, 48000);
  b.getChannelData(0).fill(1);
  await engine.start(b, { segmentStart: 1, segmentEnd: 2, preRoll: 0.5 }, {});
  const schedule = engine.roundTiming()!;
  const cue = starts.find(
    (s) => Math.abs(s.duration - SCRATCH_DURATION) < 1e-6,
  )!;
  assert(
    !!cue && Math.abs(cue.when - (schedule.b - SCRATCH_LEAD)) < 1e-6,
    "Scratch overlaps incoming B by the configured lead",
  );
  assert(
    starts.length === 7,
    "Two full-song voices, one cue and four queued Judging loops",
  );
  const samples = (await ctx.startRendering()).getChannelData(0);
  let peak = 0;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  assert(
    peak <= 1.000001,
    "Coherent full-scale A/B plus scratch stays below clipping",
  );
  assert(
    Math.abs(samples[Math.round((schedule.judging + 1.3) * 48000)] - 0.3) <
      0.0001,
    "Scratch headroom restores and Judging remains 30%",
  );
  engine.stop();
  assert(
    internal.voices.length === 0,
    "Scratch source released with all voices",
  );
  const looping = new AudioEngine(),
    loopCtx = new OfflineAudioContext(1, 48000 * 33, 48000);
  const li = looping as unknown as {
    context: BaseAudioContext;
    master: GainNode;
    voices: AudioBufferSourceNode[];
  };
  li.context = loopCtx;
  li.master = loopCtx.createGain();
  li.master.connect(loopCtx.destination);
  looping.resume = async () => {};
  const full = loopCtx.createBuffer(1, 48000 * 8, 48000);
  full.getChannelData(0).fill(0.4);
  await looping.start(
    full,
    { segmentStart: 1, segmentEnd: 2, preRoll: 0.5 },
    { scratch: false },
  );
  const rendered = (await loopCtx.startRendering()).getChannelData(0);
  for (const boundary of [8.56, 16.06, 23.56, 31.06]) {
    let min = 1,
      max = 0;
    for (
      let i = Math.floor((boundary - 0.1) * 48000);
      i < Math.floor((boundary + 0.6) * 48000);
      i++
    ) {
      min = Math.min(min, rendered[i]);
      max = Math.max(max, rendered[i]);
    }
    assert(
      min > 0.1199 && max < 0.1201,
      "Judging loop has no gap or gain surge at " +
        boundary +
        " min=" +
        min +
        " max=" +
        max +
        " samples=" +
        [
          boundary - 0.1,
          boundary,
          boundary + 0.1,
          boundary + 0.4,
          boundary + 0.5,
          boundary + 0.6,
        ].map((t) => rendered[Math.round(t * 48000)]),
    );
  }
  looping.stop();
  assert(li.voices.length === 0, "All scheduled loop voices released");
  const stopped = new AudioEngine(),
    stopCtx = new OfflineAudioContext(1, 48000 * 25, 48000);
  const si = stopped as unknown as {
    context: BaseAudioContext;
    master: GainNode;
    voices: AudioBufferSourceNode[];
  };
  si.context = stopCtx;
  si.master = stopCtx.createGain();
  si.master.connect(stopCtx.destination);
  stopped.resume = async () => {};
  await stopped.start(
    full,
    { segmentStart: 1, segmentEnd: 2, preRoll: 0.5 },
    { scratch: false },
  );
  stopped.end();
  const stoppedSamples = (await stopCtx.startRendering()).getChannelData(0);
  assert(
    stoppedSamples.slice(48000).every((x) => x === 0),
    "END cancels every queued Judging loop",
  );
  const continuous = new AudioEngine(),
    cc = new OfflineAudioContext(1, 48000 * 8, 48000);
  const ci = continuous as unknown as {
    context: BaseAudioContext;
    master: GainNode;
    voices: AudioBufferSourceNode[];
  };
  ci.context = cc;
  ci.master = cc.createGain();
  ci.master.connect(cc.destination);
  continuous.resume = async () => {};
  const offsets: number[] = [];
  const ccCreate = cc.createBufferSource.bind(cc);
  cc.createBufferSource = () => {
    const source = ccCreate(),
      start = source.start.bind(source);
    source.start = (when = 0, offset = 0) => {
      offsets.push(offset);
      start(when, offset);
    };
    return source;
  };
  const ramp = cc.createBuffer(1, 48000 * 10, 48000);
  ramp.getChannelData(0).forEach((_, i, a) => (a[i] = (i / a.length) * 0.5));
  await continuous.start(
    ramp,
    { segmentStart: 1, segmentEnd: 3, preRoll: 0.5 },
    { mode: "sequential", postRoll: 0.5 },
  );
  const cs = continuous.roundTiming()!;
  assert(
    offsets.length === 5 && offsets.slice(1).every((x) => x === 0),
    "Continue has one continuous music source plus four Judging loops; no scratch or B source",
  );
  const cr = (await cc.startRendering()).getChannelData(0);
  for (const t of [
    cs.a + 0.2,
    cs.b + 0.2,
    cs.bPerformance! + 0.2,
    cs.bEnd! + 0.2,
  ]) {
    assert(
      Math.abs(cr[Math.round(t * 48000)] - (cs.offset + t - cs.start) * 0.05) <
        0.0001,
      "Continue preserves original timeline through A, PRE B, B and POST B at " +
        t,
    );
  }
  continuous.stop();
  assert(ci.voices.length === 0, "Continue cleanup releases all voices");
  return results;
}
