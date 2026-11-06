import { AudioEngine } from "../src/audio/AudioEngine";
export async function run() {
  const results: string[] = [];
  function check(v: boolean, label: string) {
    if (!v) throw Error(label);
    results.push(label);
  }
  for (const mode of ["same", "matched", "sequential"] as const) {
    for (const point of [
      "pre",
      "a",
      "transition",
      "preB",
      "b",
      "post",
      "judging",
      "loop",
    ] as const) {
      if (
        (point === "post" && mode !== "sequential") ||
        (point === "transition" && mode === "sequential")
      )
        continue;
      const ctx = new OfflineAudioContext(1, 48000 * 12, 48000),
        e = new AudioEngine();
      const internal = e as any;
      internal.context = ctx;
      internal.master = ctx.createGain();
      internal.master.connect(ctx.destination);
      e.resume = async () => {};
      const b = ctx.createBuffer(1, 48000 * 8, 48000);
      b.getChannelData(0).fill(0.2);
      await e.start(
        b,
        { segmentStart: 1, segmentEnd: 2, preRoll: 0.5 },
        { mode, postRoll: 0.5, segmentB: { start: 3, end: 4 } },
      );
      const s = e.roundTiming()!;
      const at = {
        pre: s.start + 0.15,
        a: s.a + 0.3,
        transition: s.b + 0.01,
        preB: s.bPerformance! - 0.1,
        b: s.bPerformance! + 0.3,
        post: s.bEnd! + 0.2,
        judging: s.judging + 0.4,
        loop: 9,
      }[point];
      const stop = ctx.suspend(at),
        later = ctx.suspend(at + 0.4);
      const rendering = ctx.startRendering();
      await stop;
      e.pauseRound();
      const frozen = e.snapshot();
      check(e.paused, `${mode}/${point} paused`);
      check(
        internal.voices.length === 0,
        `${mode}/${point} old voices cancelled`,
      );
      await ctx.resume();
      await later;
      check(
        e.snapshot().position === frozen.position &&
          e.snapshot().remaining === frozen.remaining,
        `${mode}/${point} position/countdown frozen`,
      );
      await e.resumeRound();
      const resumed = e.snapshot();
      check(
        Math.abs(resumed.position - frozen.position) < 0.04,
        `${mode}/${point} resume position`,
      );
      check(resumed.phase === frozen.phase, `${mode}/${point} phase preserved`);
      await ctx.resume();
      const samples = (await rendering).getChannelData(0);
      check(
        Math.abs(samples[Math.floor((at + 0.2) * 48000)]) < 0.0001,
        `${mode}/${point} silent while paused`,
      );
      check(
        samples.some((v, i) => i > (at + 0.5) * 48000 && Math.abs(v) > 0.01),
        `${mode}/${point} resumed audio renders`,
      );
      e.stop();
      check(
        internal.voices.length === 0 && internal.pausedPlans.length === 0,
        `${mode}/${point} clean stop`,
      );
    }
  }
  for (const point of ["a", "b", "judging"] as const) {
    const ctx = new OfflineAudioContext(1, 48000 * 10, 48000),
      e = new AudioEngine(),
      x = e as any;
    x.context = ctx;
    x.master = ctx.createGain();
    x.master.connect(ctx.destination);
    e.resume = async () => {};
    const b = ctx.createBuffer(1, 48000 * 8, 48000);
    b.getChannelData(0).fill(0.2);
    await e.start(
      b,
      { segmentStart: 1, segmentEnd: 2, preRoll: 0.5 },
      { mode: "same" },
    );
    const s = e.roundTiming()!,
      at =
        point === "a"
          ? s.a + 0.2
          : point === "b"
            ? s.bPerformance! + 0.2
            : s.judging + 0.2;
    const waiting = ctx.suspend(at),
      rendering = ctx.startRendering();
    await waiting;
    await e.replayRound();
    check(e.snapshot().phase === "PRE_A", `replay from ${point} returns PRE A`);
    await ctx.resume();
    await rendering;
    e.stop();
  }
  async function render(meter: boolean) {
    const ctx = new OfflineAudioContext(1, 48000 * 4, 48000),
      e = new AudioEngine(),
      x = e as any;
    x.context = ctx;
    x.master = ctx.createGain();
    x.master.connect(ctx.destination);
    e.resume = async () => {};
    const b = ctx.createBuffer(1, 48000 * 8, 48000);
    b.getChannelData(0).fill(0.2);
    await e.start(
      b,
      { segmentStart: 1, segmentEnd: 2, preRoll: 0.5 },
      { mode: "same" },
    );
    const m = meter ? e.createMeter() : undefined;
    const output = (await ctx.startRendering()).getChannelData(0);
    m?.dispose();
    e.stop();
    return output;
  }
  const plain = await render(false),
    metered = await render(true);
  const difference = plain.reduce((max,v,i)=>Math.max(max,Math.abs(v-metered[i])),0);
  check(difference < 1e-6, `analyser output difference ${difference} (<1e-6 float tolerance)`);
  return results;
}
