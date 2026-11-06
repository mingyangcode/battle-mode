/** Small ledger of the existing gain automation, used to reconstruct a paused graph. */
type Event =
  | { kind: "set"; at: number; value: number }
  | { kind: "linear"; at: number; value: number }
  | { kind: "curve"; at: number; duration: number; values: Float32Array };
export class Automation {
  private events: Event[] = [];
  private initial: number;
  constructor(private param: AudioParam) {
    this.initial = param.value;
  }
  set value(value: number) {
    this.initial = value;
    this.param.value = value;
  }
  get value() {
    return this.param.value;
  }
  setValueAtTime(value: number, at: number) {
    this.events.push({ kind: "set", value, at });
    this.param.setValueAtTime(value, at);
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.events.push({ kind: "linear", value, at });
    this.param.linearRampToValueAtTime(value, at);
  }
  setValueCurveAtTime(values: Float32Array, at: number, duration: number) {
    this.events.push({
      kind: "curve",
      values: new Float32Array(values),
      at,
      duration,
    });
    this.param.setValueCurveAtTime(
      values as Float32Array<ArrayBuffer>,
      at,
      duration,
    );
  }
  cancelScheduledValues(at: number) {
    this.events = this.events.filter((e) => e.at < at);
    this.param.cancelScheduledValues(at);
  }
  cancelAndHoldAtTime(at: number) {
    const value = this.at(at);
    this.param.cancelAndHoldAtTime(at);
    this.events = this.events.filter(
      (e) => e.at < at && (e.kind !== "curve" || e.at + e.duration <= at),
    );
    this.events.push({ kind: "set", at, value });
  }
  at(time: number) {
    let value = this.initial,
      previous = 0;
    for (const e of [...this.events].sort((a, b) => a.at - b.at)) {
      if (e.kind === "linear") {
        if (time < e.at)
          return previous === e.at
            ? value
            : value +
                (e.value - value) *
                  Math.max(0, (time - previous) / (e.at - previous));
        value = e.value;
        previous = e.at;
      } else if (e.kind === "set") {
        if (time < e.at) return value;
        value = e.value;
        previous = e.at;
      } else {
        if (time < e.at) return value;
        if (time < e.at + e.duration) {
          const x = ((time - e.at) / e.duration) * (e.values.length - 1),
            i = Math.floor(x);
          return (
            e.values[i] +
            (e.values[Math.min(i + 1, e.values.length - 1)] - e.values[i]) *
              (x - i)
          );
        }
        value = e.values[e.values.length - 1];
        previous = e.at + e.duration;
      }
    }
    return value;
  }
  restore(param: AudioParam, pausedAt: number, shift: number) {
    const restored = new Automation(param),
      now = pausedAt + shift;
    restored.setValueAtTime(this.at(pausedAt), now);
    for (const e of [...this.events].sort((a, b) => a.at - b.at)) {
      if (e.kind === "curve") {
        if (e.at + e.duration <= pausedAt) continue;
        const start = Math.max(e.at, pausedAt),
          duration = e.at + e.duration - start;
        const values =
          start === e.at
            ? e.values
            : Float32Array.from({ length: 128 }, (_, i) =>
                this.at(start + (duration * i) / 127),
              );
        restored.setValueCurveAtTime(values, start + shift, duration);
      } else if (e.at > pausedAt) {
        if (e.kind === "set") restored.setValueAtTime(e.value, e.at + shift);
        else restored.linearRampToValueAtTime(e.value, e.at + shift);
      }
    }
    return restored;
  }
}
