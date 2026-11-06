import { copy, labels } from "../copy/zh-CN";
import { useRef, useState, type ReactNode } from "react";
import { swipeOutcome } from "../state/deletion";
export function SwipeTrack({
  children,
  trackId,
  title,
  onOpen,
  onDelete,
}: {
  children: ReactNode;
  trackId?: string;
  title: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0),
    [dragging, setDragging] = useState(false);
  const gesture = useRef<
    | {
        x: number;
        y: number;
        initial: number;
        axis?: "x" | "y";
        width: number;
        dx: number;
      }
    | undefined
  >(undefined);
  const suppress = useRef(false);
  return (
    <div id={trackId ? `track-${trackId}` : undefined} className="swipe-track">
      <button
        className="delete-track"
        aria-label={labels.deleteTrack(title)}
        onClick={onDelete}
      >
        {copy["Delete"]}
      </button>
      <button
        className="track-row swipe-front"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : undefined,
        }}
        onClick={() => {
          if (suppress.current) {
            suppress.current = false;
            return;
          }
          if (offset) {
            setOffset(0);
            return;
          }
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Delete") {
            e.preventDefault();
            onDelete();
          }
          if (e.key === "Escape") setOffset(0);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          suppress.current = false;
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            initial: offset,
            width: e.currentTarget.clientWidth,
            dx: offset,
          };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (!g.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
            g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
            if (g.axis === "x") {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              suppress.current = true;
            }
          }
          if (g.axis === "x") {
            g.dx = Math.min(0, Math.max(-g.width, g.initial + dx));
            setOffset(g.dx);
          }
        }}
        onPointerUp={() => {
          const g = gesture.current;
          gesture.current = undefined;
          setDragging(false);
          if (g?.axis === "x") {
            const outcome = swipeOutcome(g.dx, g.width);
            setOffset(outcome === "open" ? -88 : 0);
            if (outcome === "delete") onDelete();
          }
        }}
        onPointerCancel={() => {
          gesture.current = undefined;
          setDragging(false);
          setOffset(0);
        }}
      >
        {children}
      </button>
    </div>
  );
}
