import { reducedMotion } from "../utils/motion";
import { copy, labels } from "../copy/zh-CN";
import type { deriveSequential } from "../state/sequential";
import { useRef, useMemo, useLayoutEffect } from "react";
import type { Segment } from "../types/round";
import type { ReactNode } from "react";
import { clamp, type Viewport } from "../state/segmentEditor";
import { time } from "../utils/time";
interface Props extends Segment {
  duration: number;
  continuation?: ReturnType<typeof deriveSequential>;
  editableEnd?: number;
  peaks?: number[];
  position?: number;
  editable?: boolean;
  viewport?: Viewport;
  roundDuration?: number;
  overlay?: ReactNode;
  onBoundary?: (edge: "start" | "end", value: number) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onChange?: (start: number, end: number) => void;
}
export function FullTrackTimeline({
  duration,
  continuation,
  editableEnd = duration,
  peaks = [],
  segmentStart,
  segmentEnd,
  preRoll,
  position,
  editable,
  onChange,
  viewport,
  roundDuration,
  overlay,
  onBoundary,
  onEditStart,
  onEditEnd,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const view = viewport ?? { start: 0, end: duration };
  const span = Math.max(view.end - view.start, 0.01);
  const previous = useRef(view);
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = view;
    const element = ref.current;
    if (
      !element ||
      reducedMotion() ||
      !element.animate ||
      (old.start === view.start && old.end === view.end)
    )
      return;
    const width = element.clientWidth,
      oldSpan = Math.max(0.01, old.end - old.start);
    const animation = element.animate(
      [
        {
          transform: `translateX(${((view.start - old.start) / oldSpan) * width}px) scaleX(${span / oldSpan})`,
        },
        { transform: "none" },
      ],
      { duration: 220, easing: "ease-out" },
    );
    return () => animation.cancel();
  }, [view.start, view.end]);
  const pct = (n: number) => (100 * (n - view.start)) / span;
  const region = (start: number, end: number) => ({
    left: `${pct(clamp(start, view.start, view.end))}%`,
    width: `${(100 * Math.max(0, Math.min(end, view.end) - Math.max(start, view.start))) / span}%`,
  });
  const pre = Math.max(0, segmentStart - preRoll);
  // Position changes every animation frame; keep the waveform SVG stable.
  const waveform = useMemo(
    () =>
      peaks.map((p, i) => {
        const t = (i / peaks.length) * duration;
        return (
          <rect
            key={i}
            x={pct(t) * 7.2}
            y={60 - Math.max(2, p * 47)}
            width={Math.max(1, (720 * duration) / span / peaks.length - 1)}
            height={Math.max(4, p * 94)}
            rx="1"
            fill={
              t >= segmentStart && t <= segmentEnd
                ? "var(--qq-green)"
                : t >= pre && t < segmentStart
                  ? "var(--wave-pre)"
                  : "var(--wave-muted)"
            }
          />
        );
      }),
    [peaks, duration, view.start, view.end, segmentStart, segmentEnd, pre],
  );
  function update(which: "start" | "end", n: number) {
    n = Math.round(n * 10) / 10;
    if (onBoundary) {
      onBoundary(which, n);
      return;
    }
    onChange?.(
      which === "start"
        ? Math.max(0, Math.min(segmentEnd - 0.5, n))
        : segmentStart,
      which === "end"
        ? Math.min(duration, Math.max(segmentStart + 0.5, n))
        : segmentEnd,
    );
  }
  return (
    <div className={`timeline ${editable ? "editable" : ""}`}>
      <div className="timeline-labels">
        <span>{time(view.start, !!editable)}</span>
        <span>{viewport ? copy["FOCUSED SEGMENT"] : copy["FULL TRACK"]}</span>
        <span>{time(view.end, !!editable)}</span>
      </div>
      <div
        className="wave"
        ref={ref}
        onPointerDownCapture={() =>
          ref.current?.getAnimations().forEach((a) => a.cancel())
        }
        onKeyDownCapture={() =>
          ref.current?.getAnimations().forEach((a) => a.cancel())
        }
      >
        <div className="pre-region" style={region(pre, segmentStart)} />
        <div
          className="segment-region"
          style={region(segmentStart, segmentEnd)}
        />
        {continuation && (
          <>
            <div
              className="continue-region pre-b"
              style={region(continuation.bPreStart, continuation.b.start)}
            />
            <div
              className="continue-region dancer-b"
              style={region(continuation.b.start, continuation.b.end)}
            />
            <div
              className="continue-region post-b"
              style={region(continuation.b.end, continuation.postEnd)}
            />
          </>
        )}
        <svg
          className="wave-bars"
          viewBox="0 0 720 120"
          preserveAspectRatio="none"
          aria-label={
            viewport ? copy["Segment 聚焦波形"] : copy["整首歌曲波形"]
          }
          role="img"
        >
          {waveform}
        </svg>
        {editable &&
          (["start", "end"] as const).map((which) => (
            <div
              key={which}
              role="slider"
              tabIndex={0}
              aria-label={
                which === "start" ? copy["Segment start"] : copy["Segment end"]
              }
              aria-valuemin={
                which === "start" ? 0 : (roundDuration ?? segmentStart + 0.5)
              }
              aria-valuemax={
                which === "start"
                  ? roundDuration !== undefined
                    ? editableEnd - roundDuration
                    : segmentEnd - 0.5
                  : editableEnd
              }
              aria-valuenow={which === "start" ? segmentStart : segmentEnd}
              aria-valuetext={time(
                which === "start" ? segmentStart : segmentEnd,
                true,
              )}
              className={`handle ${which}`}
              style={{
                left: `${pct(which === "start" ? segmentStart : segmentEnd)}%`,
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onEditStart?.();
              }}
              onPointerMove={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                const r = ref.current!.getBoundingClientRect();
                update(
                  which,
                  clamp(
                    view.start + ((e.clientX - r.left) / r.width) * span,
                    view.start,
                    view.end,
                  ),
                );
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                onEditEnd?.();
              }}
              onPointerCancel={() => onEditEnd?.()}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  update(
                    which,
                    (which === "start" ? segmentStart : segmentEnd) +
                      (e.key === "ArrowLeft" ? -0.1 : 0.1),
                  );
                }
              }}
            >
              <span>{which === "start" ? copy["START"] : copy["END"]}</span>
              <i />
            </div>
          ))}
        {overlay}
        {position !== undefined && !overlay && (
          <div
            className="playhead"
            style={{ left: `${pct(Math.min(duration, position))}%` }}
          >
            <i />
          </div>
        )}
      </div>
      <div className="legend">
        <span>
          <i className="pre-key" />
          {Math.min(preRoll, segmentStart).toFixed(1)}
          {copy["s PRE"]}
        </span>
        <span>
          <i />
          {continuation ? "A" : copy["BATTLE SEGMENT"]}
        </span>
        {continuation && (
          <>
            <span>{copy["PRE B"]}</span>
            <span>
              <i className="b-key" />B
            </span>
            <span>{copy["POST B"]}</span>
          </>
        )}
        {position !== undefined && <b>{time(position, true)}</b>}
      </div>
    </div>
  );
}
