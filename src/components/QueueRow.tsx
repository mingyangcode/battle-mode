import { useEffect, useRef, useState } from "react";
import {
  QUEUE_HOLD_MS,
  QUEUE_REVEAL,
  queueIntent,
  queueRelease,
} from "../state/queueGesture";
import type { Track } from "../types/track";
export function QueueRow({
  id,
  index,
  track,
  panel,
  onMove,
  onRemove,
}: {
  id: string;
  index: number;
  track: Track;
  panel: React.RefObject<HTMLDivElement | null>;
  onMove: (id: string, index: number) => void;
  onRemove: (id: string) => void;
}) {
  const [offset, setOffset] = useState(0),
    [lift, setLift] = useState(0),
    [held, setHeld] = useState(false),
    [target, setTarget] = useState(index);
  const deleteArmed = useRef(false);
  const gesture = useRef<
    | {
        pointer: number;
        x: number;
        y: number;
        lastY: number;
        startOffset: number;
        scrollTop: number;
        mode: "pending" | "swipe" | "scroll" | "drag";
        element: HTMLElement;
        target: number;
        offset: number;
      }
    | undefined
  >(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    frame = useRef(0);
  function finish() {
    deleteArmed.current = false;
    clearTimeout(timer.current);
    cancelAnimationFrame(frame.current);
    const d = gesture.current;
    gesture.current = undefined;
    if (d?.element.hasPointerCapture(d.pointer))
      d.element.releasePointerCapture(d.pointer);
    setHeld(false);
    setLift(0);
  }
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );
  function moveFrame() {
    const d = gesture.current,
      scroll = panel.current;
    if (!d || d.mode !== "drag" || !scroll) return;
    const box = scroll.getBoundingClientRect();
    scroll.scrollTop +=
      d.lastY < box.top + 36 ? -5 : d.lastY > box.bottom - 36 ? 5 : 0;
    const rows = Array.from(
      scroll.querySelectorAll<HTMLElement>("[data-queue-id]"),
    );
    let nearest = index,
      distance = Infinity;
    rows.forEach((row, i) => {
      const r = row.getBoundingClientRect();
      const delta = Math.abs(d.lastY - (r.top + r.height / 2));
      if (delta < distance) {
        distance = delta;
        nearest = i;
      }
    });
    d.target = nearest;
    setTarget(nearest);
    setLift(d.lastY - d.y + scroll.scrollTop - d.scrollTop);
    frame.current = requestAnimationFrame(moveFrame);
  }
  return (
    <div
      className={`queue-swipe ${held ? "is-dragging" : ""}`}
      data-queue-id={id}
    >
      <button
        className="queue-delete"
        hidden={offset >= 0 || held}
        disabled={offset >= 0 || held}
        tabIndex={offset < 0 && !held ? 0 : -1}
        aria-hidden={offset >= 0 || held}
        aria-label={`从队列删除${track.title}`}
        onPointerDown={() => { deleteArmed.current = offset < 0 && !held && !gesture.current && !panel.current?.querySelector(".is-dragging"); }}
        onPointerCancel={() => { deleteArmed.current = false; }}
        onClick={(e) => {
          if(offset >= 0 || held || gesture.current || panel.current?.querySelector(".is-dragging")) return;
          if(e.detail !== 0 && !deleteArmed.current) return;
          deleteArmed.current = false;
          onRemove(id);
        }}
      >
        删除
      </button>
      <article
        className={`queue-item ${held ? "dragging" : ""}`}
        tabIndex={0}
        aria-label={`${track.title}，长按拖动排序，左滑显示删除按钮`}
        style={{ transform: `translate(${offset}px,${lift}px)` }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onMove(id, index + (e.key === "ArrowUp" ? -1 : 1));
          }
          if (e.key === "Delete") onRemove(id);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary) return;
          e.preventDefault();
          finish();
          const element = e.currentTarget;
          element.setPointerCapture(e.pointerId);
          gesture.current = {
            pointer: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            lastY: e.clientY,
            startOffset: offset,
            scrollTop: panel.current?.scrollTop ?? 0,
            mode: "pending",
            element,
            target: index,
            offset,
          };
          timer.current = setTimeout(() => {
            const d = gesture.current;
            if (!d || d.mode !== "pending") return;
            d.mode = "drag";
            d.offset = 0;
            setOffset(0);
            setHeld(true);
            setTarget(index);
            moveFrame();
          }, QUEUE_HOLD_MS);
        }}
        onPointerMove={(e) => {
          const d = gesture.current;
          if (!d || d.pointer !== e.pointerId) return;
          e.preventDefault();
          const dx = e.clientX - d.x,
            dy = e.clientY - d.y;
          if (d.mode === "pending") {
            d.mode = queueIntent(dx, dy);
            if (d.mode !== "pending") clearTimeout(timer.current);
          }
          if (d.mode === "scroll" && panel.current)
            panel.current.scrollTop -= e.clientY - d.lastY;
          if (d.mode === "swipe") {
            d.offset = Math.min(0, Math.max(-QUEUE_REVEAL, dx + d.startOffset));
            setOffset(d.offset);
          }
          d.lastY = e.clientY;
        }}
        onPointerUp={(e) => {
          const d = gesture.current;
          if (!d || d.pointer !== e.pointerId) return;
          if (d.mode === "drag") onMove(id, d.target);
          else if (d.mode === "swipe") {
            const action = queueRelease(d.offset);
            setOffset(action === "open" ? -QUEUE_REVEAL : 0);
          }
          finish();
        }}
        onPointerCancel={() => {
          setOffset(0);
          finish();
        }}
        onLostPointerCapture={() => {
          if (gesture.current) {
            setOffset(0);
            finish();
          }
        }}
      >
        <div>
          <small>
            {index === 0 ? "下一轮" : `第 ${index + 1} 轮`}
            {held ? ` · 松开放到第 ${target + 1} 位` : ""}
          </small>
          <strong>{track.title}</strong>
          <small>
            {track.artist ? `${track.artist} · ` : ""}
            {track.mode === "matched"
              ? "匹配"
              : track.mode === "sequential"
                ? "顺延"
                : "同段"}{" "}
            · {Math.round(track.segmentEnd! - track.segmentStart!)}秒
          </small>
        </div>
        <span className="queue-grip" aria-hidden="true">
          ⠿
        </span>
      </article>
    </div>
  );
}
