import { copy, labels } from "../copy/zh-CN";
import { useRef } from "react";
import { clamp, positionFromDrag, type Viewport } from "../state/segmentEditor";
import { time } from "../utils/time";
interface Props {
  position: number;
  viewport: Viewport;
  playing: boolean;
  onToggle: () => void;
  onSeekStart: () => void;
  onSeek: (n: number) => void;
  onSeekEnd: () => void;
}
export function EditorPlayhead({
  position,
  viewport,
  playing,
  onToggle,
  onSeekStart,
  onSeek,
  onSeekEnd,
}: Props) {
  const gesture = useRef<
    | {
        id: number;
        x: number;
        y: number;
        time: number;
        position: number;
        width: number;
        dragging: boolean;
      }
    | undefined
  >(undefined);
  const visible = clamp(position, viewport.start, viewport.end);
  const left =
    (100 * (visible - viewport.start)) / (viewport.end - viewport.start);
  function finish(cancelled = false) {
    const g = gesture.current;
    if (!g) return;
    gesture.current = undefined;
    if (g.dragging) {
      onSeekEnd();
    } else if (!cancelled) {
      if (performance.now() - g.time > 350) {
        onSeekStart();
        onSeekEnd();
      } else onToggle();
    }
  }
  return (
    <div className="editor-playhead" style={{ left: `${left}%` }}>
      <button
        type="button"
        data-guide="playhead" className="playhead-control"
        aria-label={
          playing ? copy["Pause at playhead"] : copy["Play from playhead"]
        }
        title={labels.playhead(time(position, true))}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            time: performance.now(),
            position: visible,
            width:
              e.currentTarget.parentElement!.parentElement!.getBoundingClientRect()
                .width,
            dragging: false,
          };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          if (!g.dragging && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 6)
            return;
          if (!g.dragging) {
            g.dragging = true;
            onSeekStart();
          }
          onSeek(
            positionFromDrag(g.position, e.clientX - g.x, g.width, viewport),
          );
        }}
        onPointerUp={(e) => {
          if (gesture.current?.id !== e.pointerId) return;
          finish();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={() => finish(true)}
        onClick={(e) => {
          if (e.detail === 0) onToggle();
        }}
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            onSeekStart();
            onSeek(
              e.key === "Home"
                ? viewport.start
                : e.key === "End"
                  ? viewport.end
                  : clamp(
                      position + (e.key === "ArrowLeft" ? -0.1 : 0.1),
                      viewport.start,
                      viewport.end,
                    ),
            );
            onSeekEnd();
          }
        }}
      >
        <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
      </button>
    </div>
  );
}
