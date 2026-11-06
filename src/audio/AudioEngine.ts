import { Automation } from "./Automation";
import { configurePlaybackSession } from "./playbackSession";
import { copy } from "../copy/zh-CN";
import {
  judgingLoopPlan,
  judgingLoopPosition,
  JUDGING_LOOKAHEAD_LOOPS,
} from "../state/judgingLoop";
import {
  scratchBuffer,
  SCRATCH_LEAD,
  SCRATCH_GAIN,
  TRANSITION_HEADROOM,
} from "./scratch";
import type { Segment, RoundPhase } from "../types/round";
import {
  makeSchedule,
  makeLiveSchedule,
  remainingAt,
  phaseAt,
  type PlaybackOptions,
  type Schedule,
} from "../state/roundMachine";
import {
  TRANSITION_SECONDS,
  JUDGING_FADE_SECONDS,
  END_FADE_SECONDS,
  powerCurve,
} from "./crossfade";
export const NEXT_TRACK_FADE = 1.5;
export const BACKGROUND_START_FADE = 0.7;
interface VoicePlan {
  bus: GainNode;
  buffer: AudioBuffer;
  when: number;
  offset: number;
  gain: GainNode;
  stopAt?: number;
  loop: boolean;
}
export class AudioEngine {
  private automation = new WeakMap<GainNode, Automation>();
  private plans = new Map<AudioBufferSourceNode, VoicePlan>();
  private pausedAt?: number;
  private pausedPlans: VoicePlan[] = [];
  private options?: PlaybackOptions;
  private output?: GainNode;
  private retiredBuses = new Set<GainNode>();
  private background?: { start: number; transitionEnd: number };
  private cleanBuses() {
    for (const bus of this.retiredBuses) {
      if (
        ![...this.plans.values(), ...this.pausedPlans].some(
          (p) => p.bus === bus,
        )
      ) {
        bus.disconnect();
        this.retiredBuses.delete(bus);
      }
    }
  }
  /** Keep the actual outgoing sources audible; replace only the flow gain bus. */
  private handoff(seconds: number) {
    const now = this.ctx.currentTime,
      old = this.master!;
    const gain = this.params(old),
      level = Math.min(0.7, gain.at(now));
    gain.cancelAndHoldAtTime(now);
    gain.linearRampToValueAtTime(level, now + 0.015);
    gain.setValueCurveAtTime(
      Float32Array.from(powerCurve(false), (v) => v * level),
      now + 0.015,
      seconds - 0.015,
    );
    this.loopSources.clear();
    this.loopPlan = undefined;
    this.nextLoop = 0;
    for (const source of this.voices) {
      const p = this.plans.get(source)!;
      p.loop = false;
      this.stopAt(source, Math.min(p.stopAt ?? Infinity, now + seconds));
    }
    this.retiredBuses.add(old);
    this.master = this.ctx.createGain();
    this.master.connect(this.output ?? this.ctx.destination);
    this.schedule = undefined;
    this.endingAt = undefined;
    this.background = undefined;
    return now;
  }
  async transitionToNextRound(buffer: AudioBuffer, segment: Segment, options?: PlaybackOptions) {
    if (this.busy || this.paused || this.snapshot().phase !== "JUDGING") return false;
    return (await this.start(buffer, segment, options, true)) === true;
  }
  async transitionToNext(buffer: AudioBuffer): Promise<boolean> {
    if (this.busy || this.paused || this.snapshot().phase !== "JUDGING")
      return false;
    this.busy = true;
    const generation = this.generation;
    try {
      await this.resume();
      if (generation !== this.generation) return false;
      const now = this.handoff(NEXT_TRACK_FADE),
        start = now + 0.015;
      this.buffer = buffer;
      this.background = { start, transitionEnd: now + NEXT_TRACK_FADE };
      const master = this.params(this.master!);
      master.value = 0;
      master.setValueCurveAtTime(
        Float32Array.from(powerCurve(true), (v) => v * 0.3),
        start,
        NEXT_TRACK_FADE - 0.015,
      );
      const voice = this.ctx.createGain();
      this.params(voice).setValueAtTime(1, start);
      this.voice(buffer, start, 0, voice);
      const fileEnd = start + buffer.duration;
      this.loopPlan = judgingLoopPlan(fileEnd, start, buffer.duration);
      this.params(voice).setValueAtTime(1, this.loopPlan.first);
      this.params(voice).linearRampToValueAtTime(0, fileEnd);
      this.refillJudging();
      return true;
    } finally {
      this.busy = false;
    }
  }
  async startFromBackground(segment: Segment, options?: PlaybackOptions) {
    if (
      this.snapshot().phase !== "INTER_ROUND_BG" ||
      this.paused ||
      !this.buffer
    )
      return;
    await this.start(this.buffer, segment, options, true);
  }
  private params(node: GainNode) {
    let value = this.automation.get(node);
    if (!value) {
      value = new Automation(node.gain);
      this.automation.set(node, value);
    }
    return value;
  }
  get paused() {
    return this.pausedAt !== undefined;
  }
  private stopAt(source: AudioBufferSourceNode, at: number) {
    const p = this.plans.get(source);
    if (p) p.stopAt = at;
    source.stop(at);
  }
  pauseRound() {
    if (
      (!this.schedule && !this.background) ||
      this.paused ||
      this.endingAt !== undefined ||
      this.busy
    )
      return;
    const now = this.ctx.currentTime;
    this.pausedAt = now;
    this.pausedPlans = [...this.plans.values()];
    this.loopSources.clear();
    for (const source of this.voices) {
      const p = this.plans.get(source);
      if (p) {
        p.gain.gain.cancelScheduledValues(now);
        p.gain.gain.setValueAtTime(this.params(p.gain).at(now), now);
        p.gain.gain.linearRampToValueAtTime(0, now + 0.015);
      }
      source.stop(now + 0.015);
    }
    this.voices = [];
    this.plans.clear();
  }
  async resumeRound() {
    if (!this.paused || this.busy) return;
    this.busy = true;
    const generation = this.generation;
    try {
      await this.resume();
      if (generation !== this.generation || this.pausedAt === undefined) return;
      const paused = this.pausedAt,
        shift = this.ctx.currentTime - paused;
      const s = this.schedule!;
      for (const key of [
        "start",
        "a",
        "b",
        "transitionEnd",
        "judging",
        "bEnd",
        "aEnd",
        "bPerformance",
      ] as const)
        if (s?.[key] !== undefined) s[key]! += shift;
      if (this.background) {
        this.background.start += shift;
        this.background.transitionEnd += shift;
      }
      if (this.loopPlan) this.loopPlan.first += shift;
      for (const bus of new Set([
        this.master!,
        ...this.pausedPlans.map((p) => p.bus),
      ])) {
        bus.gain.cancelScheduledValues(0);
        this.automation.set(
          bus,
          this.params(bus).restore(bus.gain, paused, shift),
        );
      }
      for (const p of this.pausedPlans) {
        const end = Math.min(
          p.when + p.buffer.duration - p.offset,
          p.stopAt ?? Infinity,
        );
        if (end <= paused) continue;
        const gain = this.ctx.createGain();
        this.automation.set(
          gain,
          this.params(p.gain).restore(gain.gain, paused, shift),
        );
        const source = this.voice(
          p.buffer,
          Math.max(p.when, paused) + shift,
          p.offset + Math.max(0, paused - p.when),
          gain,
          true,
          p.bus,
        );
        if (p.loop) {
          this.loopSources.add(source);
          this.plans.get(source)!.loop = true;
        }
        if (p.stopAt !== undefined) this.stopAt(source, p.stopAt + shift);
      }
      this.pausedPlans = [];
      this.pausedAt = undefined;
      this.refillJudging();
      this.cleanBuses();
    } finally {
      this.busy = false;
    }
  }
  async replayRound() {
    if (!this.schedule || !this.buffer || !this.segment || this.busy) return;
    const buffer = this.buffer,
      segment = this.segment,
      options = this.options;
    this.stop();
    await this.start(buffer, segment, options);
  }
  private context?: AudioContext;
  private master?: GainNode;
  private voices: AudioBufferSourceNode[] = [];
  private schedule?: Schedule;
  private segment?: Segment;
  private buffer?: AudioBuffer;
  private endingAt?: number;
  private previewAt?: number;
  private previewOffset = 0;
  private previewEndAt?: number;
  private previewEndPosition = 0;
  private previewGain?: GainNode;
  private previewSource?: AudioBufferSourceNode;
  private loopPlan?: ReturnType<typeof judgingLoopPlan>;
  private loopSources = new Set<AudioBufferSourceNode>();
  private nextLoop = 0;
  private busy = false;
  private generation = 0;
  createMeter() {
    // Read-only branch: never insert the analyser into the audible path.
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    const output = this.output ?? this.master!;
    output.connect(analyser);
    return {
      analyser,
      dispose: () => {
        try {
          output.disconnect(analyser);
        } catch {}
        analyser.disconnect();
      },
    };
  }
  roundTiming() {
    return this.schedule;
  }
  get ctx() {
    if (!this.context) {
      configurePlaybackSession();
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.output = this.context.createGain();
      this.master.connect(this.output);
      this.output.connect(this.context.destination);
    }
    return this.context;
  }
  async decode(file: Blob) {
    return this.ctx.decodeAudioData(await file.arrayBuffer());
  }
  async resume() {
    configurePlaybackSession();
    await this.ctx.resume();
    if (this.ctx.state !== "running")
      throw new Error(copy["音频尚未恢复，请再次点击播放。"]);
  }
  get suspended() {
    return !!this.context && this.context.state !== "running";
  }
  private voice(
    buffer: AudioBuffer,
    when: number,
    offset: number,
    gain: GainNode,
    fadeIn = false,
    bus = this.master!,
  ) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    const gate = fadeIn ? this.ctx.createGain() : undefined;
    if (gate) {
      gate.gain.setValueAtTime(0, when);
      gate.gain.linearRampToValueAtTime(1, when + 0.015);
      gain.connect(gate);
      gate.connect(bus);
    } else gain.connect(bus);
    source.start(when, offset);
    this.plans.set(source, { buffer, when, offset, gain, loop: false, bus });
    this.voices.push(source);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      gate?.disconnect();
      this.plans.delete(source);
      this.voices = this.voices.filter((v) => v !== source);
      if (this.loopSources.delete(source)) this.refillJudging();
      this.cleanBuses();
    };
    return source;
  }
  async start(
    buffer: AudioBuffer,
    segment: Segment,
    options?: PlaybackOptions,
    fromBackground = false,
  ) {
    if (this.busy || (this.schedule && !(fromBackground && this.snapshot().phase === "JUDGING"))) return;
    this.busy = true;
    const generation = this.generation;
    try {
      if (!(
        [segment.segmentStart, segment.segmentEnd, segment.preRoll].every(
          Number.isFinite,
        ) &&
        segment.segmentStart >= 0 &&
        segment.segmentEnd > segment.segmentStart &&
        segment.segmentEnd <= buffer.duration &&
        segment.preRoll >= 0
      ))
        throw new Error(copy["Segment 时间无效。"]);
      await this.resume();
      if (generation !== this.generation) return;
      if (fromBackground) this.handoff(BACKGROUND_START_FADE);
      else this.stop();
      this.options = options;
      this.buffer = buffer;
      this.segment = segment;
      const fade = Math.min(
        TRANSITION_SECONDS,
        (segment.segmentEnd - segment.segmentStart) / 2,
      );
      const s = options
        ? makeLiveSchedule(
            this.ctx.currentTime,
            segment,
            buffer.duration,
            options,
          )
        : makeSchedule(this.ctx.currentTime, segment, fade);
      const crossfade = s.transitionEnd - s.b;
      this.schedule = s;
      const master = this.params(this.master!);
      master.cancelScheduledValues(0);
      master.setValueAtTime(fromBackground ? 0 : 1, this.ctx.currentTime);
      if (fromBackground)
        master.linearRampToValueAtTime(
          1,
          this.ctx.currentTime + BACKGROUND_START_FADE,
        );
      if (s.sequential) {
        const gain = this.ctx.createGain();
        this.params(gain).value = 0;
        this.params(gain).setValueAtTime(0, s.start);
        this.params(gain).linearRampToValueAtTime(1, s.start + 0.015);
        this.voice(buffer, s.start, s.offset, gain);
        this.scheduleJudging(gain, s.start + buffer.duration - s.offset, s);
      } else {
        const a = this.ctx.createGain(),
          b = this.ctx.createGain();
        this.params(a).setValueAtTime(0, s.start);
        this.params(a).linearRampToValueAtTime(1, s.start + 0.015);
        const aFileEnd = s.start + buffer.duration - s.offset;
        const aFadeEnd = Math.min(s.transitionEnd, aFileEnd);
        const aFadeStart = Math.min(s.b, aFadeEnd - 0.015);
        this.params(a).setValueCurveAtTime(
          powerCurve(false),
          aFadeStart,
          aFadeEnd - aFadeStart,
        );
        this.params(b).setValueAtTime(0, s.b);
        this.params(b).setValueCurveAtTime(powerCurve(true), s.b, crossfade);
        // A completes its entire segment. Its post-segment tail overlaps B's segment entrance.
        const sourceA = this.voice(buffer, s.start, s.offset, a);
        this.stopAt(sourceA, s.transitionEnd);
        this.voice(buffer, s.b, s.bOffset ?? segment.segmentStart, b);
        if (options) {
          const fileEnd =
            s.b + buffer.duration - (s.bOffset ?? segment.segmentStart);
          this.scheduleJudging(b, fileEnd, s);
        }
      }
      if (options && !s.sequential && options.scratch !== false) {
        const cue = scratchBuffer(this.ctx),
          cueAt = Math.max(s.start, s.b - SCRATCH_LEAD);
        const gain = this.ctx.createGain();
        this.params(gain).setValueAtTime(SCRATCH_GAIN, cueAt);
        this.voice(cue, cueAt, 0, gain);
        // Worst-case full-scale coherent voices: sqrt(2)*0.65 + 0.12*0.65 < 1.
        const rampStart = Math.max(this.ctx.currentTime, cueAt - 0.015);
        master.setValueAtTime(1, rampStart);
        master.linearRampToValueAtTime(TRANSITION_HEADROOM, cueAt);
        const restore = Math.min(
          s.judging - 0.015,
          Math.max(s.transitionEnd, cueAt + cue.duration),
        );
        master.setValueAtTime(TRANSITION_HEADROOM, restore);
        master.linearRampToValueAtTime(1, Math.min(s.judging, restore + 0.015));
      }
      master.setValueAtTime(1, s.judging);
      master.linearRampToValueAtTime(0.3, s.judging + JUDGING_FADE_SECONDS);
      return true;
    } finally {
      this.busy = false;
    }
  }
  private scheduleJudging(gain: GainNode, fileEnd: number, s: Schedule) {
    this.loopPlan = judgingLoopPlan(fileEnd, s.judging, this.buffer!.duration);
    const first = this.loopPlan.first;
    this.params(gain).setValueAtTime(
      1,
      Math.max(s.transitionEnd, Math.min(first, fileEnd - 0.015)),
    );
    this.params(gain).linearRampToValueAtTime(0, fileEnd);
    this.refillJudging();
  }
  private refillJudging() {
    if (
      this.paused ||
      !this.loopPlan ||
      !this.buffer ||
      this.endingAt !== undefined ||
      this.ctx.state === "closed"
    )
      return;
    const { first, period, fade, firstFade } = this.loopPlan;
    // Four complete future loops are audio-clock scheduled. onended replenishes
    // the horizon; it never starts a source "now" or drives gain incrementally.
    while (this.loopSources.size < JUDGING_LOOKAHEAD_LOOPS) {
      const index = this.nextLoop++;
      const start = first + index * period;
      if (start + this.buffer.duration < this.ctx.currentTime) continue;
      const gain = this.ctx.createGain();
      this.params(gain).value = 0;
      this.params(gain).setValueAtTime(0, start);
      this.params(gain).linearRampToValueAtTime(
        1,
        start + (index === 0 ? firstFade : fade),
      );
      this.params(gain).setValueAtTime(1, start + period);
      this.params(gain).linearRampToValueAtTime(
        0,
        start + this.buffer.duration,
      );
      const source = this.voice(this.buffer, start, 0, gain);
      this.loopSources.add(source);
      this.plans.get(source)!.loop = true;
      this.stopAt(source, start + this.buffer.duration);
    }
  }
  end() {
    if ((!this.schedule && !this.background) || this.endingAt !== undefined)
      return;
    if (this.paused) {
      this.pausedPlans = [];
      this.pausedAt = undefined;
      this.endingAt = this.ctx.currentTime;
      return;
    }
    const now = this.ctx.currentTime;
    for (const bus of [this.master!, ...this.retiredBuses]) {
      const gain = this.params(bus);
      gain.cancelAndHoldAtTime(now);
      gain.linearRampToValueAtTime(0, now + END_FADE_SECONDS);
    }
    this.endingAt = now + END_FADE_SECONDS;
    for (const source of this.voices) {
      try {
        source.stop(this.endingAt);
      } catch {
        /* already ended */
      }
    }
  }
  snapshot(): {
    phase: RoundPhase;
    position: number;
    finished: boolean;
    remaining?: number;
    incoming?: boolean;
  } {
    if (this.background) {
      const now = this.pausedAt ?? this.ctx.currentTime;
      return {
        phase:
          this.endingAt !== undefined
            ? "END_ROUND"
            : now < this.background.transitionEnd
              ? "TRANSITION_TO_NEXT"
              : "INTER_ROUND_BG",
        position:
          (this.loopPlan
            ? judgingLoopPosition(
                now,
                this.loopPlan.first,
                this.loopPlan.period,
              )
            : undefined) ?? Math.max(0, now - this.background.start),
        finished: this.endingAt !== undefined && now >= this.endingAt,
      };
    }
    if (!this.schedule || !this.segment)
      return { phase: "READY", position: 0, finished: false };
    const now = this.pausedAt ?? this.ctx.currentTime,
      s = this.schedule;
    const phase = this.endingAt !== undefined ? "END_ROUND" : phaseAt(now, s);
    const position =
      s.sequential || now < s.b
        ? s.offset + Math.max(0, now - s.start)
        : (s.bOffset ?? this.segment.segmentStart) + now - s.b;
    return {
      phase,
      remaining: this.endingAt === undefined ? remainingAt(now, s) : undefined,
      incoming: now >= s.b,
      position:
        this.loopPlan && now >= s.judging
          ? (judgingLoopPosition(
              now,
              this.loopPlan.first,
              this.loopPlan.period,
            ) ?? Math.min(this.buffer!.duration, position))
          : Math.min(this.buffer!.duration, position),
      finished: this.endingAt !== undefined && now >= this.endingAt,
    };
  }
  // Editor transport also reads the full buffer; range is scheduling metadata only.
  async preview(buffer: AudioBuffer, segment: Segment) {
    return this.playRange(
      buffer,
      Math.max(0, segment.segmentStart - segment.preRoll),
      Math.min(buffer.duration, segment.segmentEnd + 4),
    );
  }
  async playRange(
    buffer: AudioBuffer,
    from: number,
    to = buffer.duration,
  ): Promise<boolean> {
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from < 0 ||
      to > buffer.duration ||
      to <= from
    )
      throw new Error(copy["播放范围无效，请将播放头移到歌曲结束之前。"]);
    // Latest request wins, including a drag/pause while AudioContext.resume is pending.
    const generation = ++this.generation;
    await this.resume();
    if (generation !== this.generation) return false;
    this.stop();
    this.buffer = buffer;
    const now = this.ctx.currentTime + 0.03,
      length = to - from;
    this.previewAt = now;
    this.previewOffset = from;
    this.previewEndAt = now + length;
    this.previewEndPosition = to;
    const gain = this.ctx.createGain();
    this.previewGain = gain;
    const attack = Math.min(0.015, length / 4),
      release = Math.min(0.04, length / 4);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + attack);
    gain.gain.setValueAtTime(1, now + length - release);
    gain.gain.linearRampToValueAtTime(0, now + length);
    this.master!.gain.setValueAtTime(1, this.ctx.currentTime);
    const source = this.voice(buffer, now, from, gain);
    this.previewSource = source;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.plans.delete(source);
      this.voices = this.voices.filter((v) => v !== source);
    };
    source.stop(now + length);
    return true;
  }
  previewPosition() {
    if (this.previewAt === undefined) return undefined;
    return Math.min(
      this.previewEndPosition,
      this.previewOffset + Math.max(0, this.ctx.currentTime - this.previewAt),
    );
  }
  previewSnapshot() {
    return {
      position: this.previewPosition(),
      playing:
        this.previewAt !== undefined &&
        this.previewEndAt !== undefined &&
        this.ctx.currentTime < this.previewEndAt,
      suspended: this.suspended,
    };
  }
  pausePreview() {
    const position = this.previewPosition();
    this.generation++;
    if (
      this.previewGain &&
      this.previewSource &&
      this.previewEndAt !== undefined
    ) {
      const now = this.ctx.currentTime;
      if (now < this.previewEndAt) {
        this.previewGain.gain.cancelAndHoldAtTime(now);
        this.previewGain.gain.linearRampToValueAtTime(0, now + 0.015);
        try {
          this.previewSource.stop(now + 0.015);
        } catch {}
      }
    }
    this.previewAt = undefined;
    this.previewEndAt = undefined;
    this.previewGain = undefined;
    this.previewSource = undefined;
    return position;
  }
  stop() {
    this.generation++;
    this.pausedAt = undefined;
    this.pausedPlans = [];
    this.plans.clear();
    for (const source of this.voices) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    this.voices = [];
    this.background = undefined;
    this.cleanBuses();
    this.loopPlan = undefined;
    this.loopSources.clear();
    this.nextLoop = 0;
    if (this.master) this.params(this.master).cancelScheduledValues(0);
    this.schedule = undefined;
    this.endingAt = undefined;
    this.previewAt = undefined;
    this.previewEndAt = undefined;
    this.previewGain = undefined;
    this.previewSource = undefined;
    this.buffer = undefined;
  }
}
export const audio = new AudioEngine();
