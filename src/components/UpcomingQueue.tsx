import { QueueRow } from "./QueueRow";
import { useRef, useState } from "react";
import type { Track } from "../types/track";
import type { QueuedRound } from "../state/liveQueue";
export function UpcomingQueue({
  items,
  tracks,
  preparation,
  onAdd,
  onRemove,
  onMove,
  onClose,
}: {
  preparation?: string;
  items: QueuedRound[];
  tracks: Track[];
  onAdd: (t: Track) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, index: number) => void;
  onClose: () => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  return (
    <section
      className="queue-panel"
      data-page-swipe-ignore
      aria-label="后续轮次"
    >
      <header>
        <h2>
          {selecting ? "选择后续音乐" : "后续轮次"}{" "}
          <small>{items.length}</small>
        </h2>
        <button onClick={() => (selecting ? setSelecting(false) : onClose())}>
          {selecting ? "完成" : "收起"}
        </button>
      </header>
      {preparation && (
        <p className="hint" role="status">
          {preparation}
        </p>
      )}
      <div className="queue-scroll" ref={panel}>
        {selecting ? (
          tracks
            .filter((t) => t.isPrepared)
            .sort(
              (a, b) => Number(a.playedCount > 0) - Number(b.playedCount > 0),
            )
            .map((t) => (
              <button
                key={t.id}
                className={`queue-choice ${t.playedCount ? "played" : ""}`}
                onClick={() => onAdd(t)}
              >
                <strong>{t.title}</strong>
                <small>
                  {t.playedCount ? "✓ 已使用" : "未使用"}
                  {items.some((i) => i.trackId === t.id) ? " · 已预选" : ""}
                </small>
                <span>＋</span>
              </button>
            ))
        ) : (
          <>
            {!items.length && <p className="hint">先选择下一轮音乐</p>}
            {items.map((item, i) => {
              const t = tracks.find((t) => t.id === item.trackId);
              if (!t) return null;
              return (
                <QueueRow
                  key={item.id}
                  id={item.id}
                  index={i}
                  track={t}
                  panel={panel}
                  onMove={onMove}
                  onRemove={onRemove}
                />
              );
            })}
          </>
        )}
      </div>
      {!selecting && (
        <button
          className="secondary queue-add"
          onClick={() => setSelecting(true)}
        >
          ＋ 选择音乐
        </button>
      )}
    </section>
  );
}
