import { AudioEngine } from "../src/audio/AudioEngine";
import { makeSchedule, phaseAt } from "../src/state/roundMachine";
import { powerCurve } from "../src/audio/crossfade";
export async function runAudioTests() {
  const results: string[] = [];
  const assert = (condition: boolean, label: string) => {
    if (!condition) throw new Error(label);
    results.push(label);
  };
  const s = makeSchedule(
    0,
    { segmentStart: 2, segmentEnd: 6, preRoll: 5 },
    0.5,
  );
  assert(s.offset === 0, "Pre clamps to zero");
  assert(Math.abs(s.b - s.a - 4) < 1e-9, "A receives full segment duration");
  assert(Math.abs(s.judging - s.b - 4) < 1e-9, "B receives identical duration");
  assert(phaseAt(s.b + 0.1, s) === "TRANSITION", "Transition phase");
  assert(
    phaseAt(s.judging + 3, s) === "JUDGING",
    "Judging persists beyond segment",
  );
  const incoming = powerCurve(true),
    outgoing = powerCurve(false);
  assert(
    incoming.every(
      (x, i) => Math.abs(x * x + outgoing[i] * outgoing[i] - 1) < 1e-6,
    ),
    "Equal-power curves",
  );
  const ctx = new OfflineAudioContext(1, 48000 * 3, 48000);
  const engine = new AudioEngine();
  // Inject a real offline graph to validate the scheduled Web Audio rendering.
  const internals = engine as unknown as {
    context: BaseAudioContext;
    master: GainNode;
  };
  internals.context = ctx;
  internals.master = ctx.createGain();
  internals.master.connect(ctx.destination);
  engine.resume = async () => {};
  const buffer = ctx.createBuffer(1, 48000 * 4, 48000);
  buffer.getChannelData(0).fill(0.25);
  await engine.start(buffer, {
    segmentStart: 0.2,
    segmentEnd: 1,
    preRoll: 0.1,
  });
  const rendered = await ctx.startRendering();
  const data = rendered.getChannelData(0);
  const value = (t: number) => data[Math.floor(t * 48000)];
  assert(Math.abs(value(0.5) - 0.25) < 0.001, "A renders full audio");
  assert(value(1.1) > 0.25 && value(1.1) < 0.36, "Two voices overlap smoothly");
  assert(
    Math.abs(value(1.6) - 0.25) < 0.001,
    "B remains at full volume before judging",
  );
  assert(
    value(2) > 0.075 && value(2) < 0.25,
    "Judging fade continues original audio",
  );
  assert(Math.abs(value(2.95) - 0.075) < 0.001, "Judging reaches 30 percent");

  const stopContext = new OfflineAudioContext(1, 48000 * 2, 48000),
    stopped = new AudioEngine();
  const stopInternals = stopped as unknown as {
    context: BaseAudioContext;
    master: GainNode;
    voices: AudioBufferSourceNode[];
  };
  stopInternals.context = stopContext;
  stopInternals.master = stopContext.createGain();
  stopInternals.master.connect(stopContext.destination);
  stopped.resume = async () => {};
  const full = stopContext.createBuffer(1, 48000 * 4, 48000);
  full.getChannelData(0).fill(0.25);
  await Promise.all([
    stopped.start(full, { segmentStart: 0.2, segmentEnd: 1, preRoll: 0.1 }),
    stopped.start(full, { segmentStart: 0.2, segmentEnd: 1, preRoll: 0.1 }),
  ]);
  assert(
    stopInternals.voices.length === 2,
    "Repeated START schedules only two voices",
  );
  stopped.end();
  stopped.end();
  const tail = await stopContext.startRendering();
  const samples = tail.getChannelData(0);
  assert(
    samples[48000 * 0.3] > 0.05 && samples[48000 * 0.3] < 0.2,
    "END renders a fade, not a hard cut",
  );
  assert(
    samples.slice(48000 * 0.6).every((x) => x === 0),
    "Early END cancels future B and judging automation",
  );
  const invalid = new AudioEngine();
  let rejected = false;
  try {
    await invalid.start(full, { segmentStart: 2, segmentEnd: 6, preRoll: 5 });
  } catch {
    rejected = true;
  }
  assert(rejected, "Out-of-bounds segment is rejected before playback");

  const sameContext = new OfflineAudioContext(1, 48000 * 2, 48000),
    same = new AudioEngine();
  const sameInternals = same as unknown as {
    context: BaseAudioContext;
    master: GainNode;
  };
  sameInternals.context = sameContext;
  sameInternals.master = sameContext.createGain();
  sameInternals.master.connect(sameContext.destination);
  same.resume = async () => {};
  const ramp = sameContext.createBuffer(1, 48000 * 4, 48000);
  const rampData = ramp.getChannelData(0);
  for (let i = 0; i < rampData.length; i++)
    rampData[i] = 0.1 + (0.02 * i) / 48000;
  await same.start(ramp, { segmentStart: 0.2, segmentEnd: 1, preRoll: 0.1 });
  const sameRendered = await sameContext.startRendering();
  const sameData = sameRendered.getChannelData(0);
  assert(
    Math.abs(
      sameData[Math.floor(0.6 * 48000)] - sameData[Math.floor(1.4 * 48000)],
    ) < 0.00001,
    "A and B read identical positions from the full buffer",
  );
  return results;
}
