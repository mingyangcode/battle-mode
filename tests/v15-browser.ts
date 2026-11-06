import { AudioEngine } from "../src/audio/AudioEngine";
export async function run() {
  const out: string[] = [];
  const check = (v: boolean, s: string) => {
    if (!v) throw Error(s);
    out.push("PASS " + s);
  };
  for (const mode of ["same", "matched", "sequential"] as const) {
    const ctx = new OfflineAudioContext(1, 48000 * 23, 48000),
      e = new AudioEngine(),
      i = e as any;
    i.context = ctx;
    i.master = ctx.createGain();
    i.master.connect(ctx.destination);
    e.resume = async () => {};
    const a = ctx.createBuffer(1, 48000 * 8, 48000),
      b = ctx.createBuffer(1, 48000 * 5, 48000);
    a.getChannelData(0).fill(0.8);
    b.getChannelData(0).fill(0.8);
    const segment = { segmentStart: 1, segmentEnd: 2, preRoll: 0.5 };
    await e.start(a, segment, {
      mode,
      postRoll: 0.5,
      segmentB: { start: 3, end: 4 },
      scratch: false,
    });
    const j = e.roundTiming()!.judging + 1.3;
    const stops = [
      j,
      j + 1.7,
      j + 2.1,
      j + 2.5,
      j + 3,
      j + 4,
      j + 4.4,
      j + 5,
      j + 6.5,
      j + 7,
      j + 17,
    ].map((x) => ctx.suspend(x));
    const rendering = ctx.startRendering();
    await stops[0];
    check(e.snapshot().phase === "JUDGING", mode + " judging");
    check(await e.transitionToNext(b), mode + " transition accepted");
    check(
      !(await e.transitionToNext(a)),
      mode + " duplicate transition rejected",
    );
    check(
      e.snapshot().phase === "TRANSITION_TO_NEXT",
      mode + " transition state",
    );
    await ctx.resume();
    await stops[1];
    check(
      e.snapshot().phase === "INTER_ROUND_BG",
      mode + " stays background, no auto PRE",
    );
    check(
      e.snapshot().position > 1.5 && e.snapshot().position < 1.8,
      mode + " starts new full song at zero",
    );
    e.pauseRound();
    const pos = e.snapshot().position;
    await ctx.resume();
    await stops[2];
    check(
      e.snapshot().position === pos,
      mode + " background pause freezes clock",
    );
    await e.resumeRound();
    await ctx.resume();
    await stops[3];
    check(e.snapshot().position > pos + 0.3, mode + " background resume");
    await e.startFromBackground(segment, {
      mode,
      postRoll: 0.5,
      segmentB: { start: 3, end: 4 },
      scratch: false,
    });
    check(e.snapshot().phase === "PRE_A", mode + " explicit start enters PRE");
    await ctx.resume();
    await stops[4];
    e.pauseRound();
    await ctx.resume();
    await stops[5];
    await e.resumeRound();
    await ctx.resume();
    await stops[6];
    check(
      !e.paused && e.roundTiming() !== undefined,
      mode + " PRE handoff pause/rebuild",
    );
    await ctx.resume();
    await stops[7];
    await ctx.resume();
    await stops[8];
    await ctx.resume();
    await stops[9];
    // Wait through the new round and several song-tail joins before ending.
    await ctx.resume();
    await stops[10];
    check(e.snapshot().phase === "JUDGING", mode + " new round judging");
    e.end();
    await ctx.resume();
    const rendered = await rendering;
    const data = rendered.getChannelData(0);
    let peak = 0,
      min = Infinity;
    for (
      let n = Math.ceil((j + 0.02) * 48000);
      n < Math.floor((j + 1.45) * 48000);
      n++
    ) {
      peak = Math.max(peak, Math.abs(data[n]));
      min = Math.min(min, Math.abs(data[n]));
    }
    check(peak < 1 && min > 0.1, mode + " cross-song signal no clipping/gap");
    e.stop();
    check(
      i.plans.size === 0 && i.voices.length === 0 && i.retiredBuses.size === 0,
      mode + " all sources/buses cleaned",
    );
  }
  for (const endDuringFade of [false, true]) {
    const ctx = new OfflineAudioContext(1, 48000 * 26, 48000),
      e = new AudioEngine(),
      i = e as any;
    i.context = ctx;
    i.master = ctx.createGain();
    i.master.connect(ctx.destination);
    e.resume = async () => {};
    const b = ctx.createBuffer(1, 48000 * 4, 48000);
    b.getChannelData(0).fill(0.5);
    await e.start(
      b,
      { segmentStart: 0.5, segmentEnd: 1, preRoll: 0.1 },
      { mode: "same", scratch: false },
    );
    const at = e.roundTiming()!.judging + 1.4;
    const stop = ctx.suspend(at),
      later = ctx.suspend(at + (endDuringFade ? 0.2 : 17));
    const rendering = ctx.startRendering();
    await stop;
    await e.transitionToNext(b);
    await ctx.resume();
    await later;
    check(
      e.snapshot().phase ===
        (endDuringFade ? "TRANSITION_TO_NEXT" : "INTER_ROUND_BG"),
      "background maintains phase after " +
        (endDuringFade ? "fade start" : "four loops"),
    );
    if (!endDuringFade)
      check(
        e.snapshot().position >= 0 && e.snapshot().position < 4,
        "background loop position wraps",
      );
    const ended = ctx.currentTime;
    e.end();
    await ctx.resume();
    const rendered = await rendering;
    const data = rendered.getChannelData(0);
    let tailPeak = 0;
    for (let n = Math.ceil((ended + 0.6) * 48000); n < data.length; n++)
      tailPeak = Math.max(tailPeak, Math.abs(data[n]));
    check(
      tailPeak === 0,
      "end cancels current and scheduled background sources " + endDuringFade,
    );
    e.stop();
    check(
      i.retiredBuses.size === 0 && i.plans.size === 0,
      "background end cleans buses " + endDuringFade,
    );
  }
  out.push("V1.5 audio tests complete");
  return out;
}
