import { AudioEngine } from "../src/audio/AudioEngine";
import { phaseAt, remainingAt } from "../src/state/roundMachine";
export async function run() {
  const results: string[] = [];
  const assert = (v: boolean, label: string) => {
    if (!v) throw new Error(label);
    results.push(label);
  };
  for (const matched of [false, true]) {
    const ctx = new OfflineAudioContext(1, 48000 * 8, 48000),
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
    const buffer = ctx.createBuffer(1, 48000 * 12, 48000),
      samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++)
      samples[i] = 0.1 + (0.01 * i) / 48000;
    const segment = { segmentStart: 2, segmentEnd: 3.5, preRoll: 1 },
      options = {scratch:false, segmentB: matched ? { start: 6, end: 7.5 } : undefined };
    await Promise.all([
      engine.start(buffer, segment, options),
      engine.start(buffer, segment, options),
    ]);
    const s = engine.roundTiming()!;
    assert(
      internal.voices.length === 6,
      "Duplicate START protected " + matched,
    );
    assert(
      Math.abs(s.bPerformance! - s.b - 1) < 1e-9,
      "Full B PRE scheduled " + matched,
    );
    assert(
      phaseAt(s.transitionEnd + 0.01, s) === "PRE_B",
      "PRE_B phase " + matched,
    );
    assert(
      Math.abs(remainingAt(s.b + 0.7, s)! - 0.3) < 1e-9,
      "Actual B pre countdown " + matched,
    );
    const rendered = (await ctx.startRendering()).getChannelData(0);
    const at = (t: number) => rendered[Math.round(t * 48000)];
    const expected = (position: number) => 0.1 + 0.01 * position;
    assert(
      Math.abs(at(s.a + 1.49) - expected(3.49)) < 0.00003,
      "A reaches full segment end " + matched,
    );
    assert(
      Math.abs(at(s.b + 0.8) - expected(s.bOffset! + 0.8)) < 0.00003,
      "B PRE reads full-song offset " + matched,
    );
    assert(
      Math.abs(at(s.bPerformance! + 0.7) - expected((matched ? 6 : 2) + 0.7)) <
        0.00003,
      "B performance correct source position " + matched,
    );
    assert(
      Math.abs(
        at(s.judging + 1.4) - expected((matched ? 7.5 : 3.5) + 1.4) * 0.3,
      ) < 0.00003,
      "B continues original song at 30% " + matched,
    );
    engine.stop();
    assert(internal.voices.length === 0, "Stop releases voices " + matched);
  }
  // Repeated schedules use fresh currentTime; no accumulated wall-clock drift or retained voices.
  const ctx = new OfflineAudioContext(1, 48000, 48000),
    engine = new AudioEngine();
  const internals = engine as unknown as {
    context: BaseAudioContext;
    master: GainNode;
    voices: AudioBufferSourceNode[];
    buffer?: AudioBuffer;
  };
  internals.context = ctx;
  internals.master = ctx.createGain();
  internals.master.connect(ctx.destination);
  engine.resume = async () => {};
  const b = ctx.createBuffer(1, 48000 * 12, 48000);
  for (let i = 0; i < 30; i++) {
    await engine.start(b, { segmentStart: 2, segmentEnd: 3.5, preRoll: 1 }, {});
    engine.end();
    engine.end();
    engine.stop();
    assert(
      internals.voices.length === 0 && !internals.buffer,
      "Repeated round cleanup " + i,
    );
  }
  return results;
}
