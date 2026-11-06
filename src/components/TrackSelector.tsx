import { TrackArtwork } from "./TrackArtwork";
import { copy, labels } from "../copy/zh-CN";
import { useEffect, useRef } from "react";
import type { Track } from "../types/track";
import { Icon } from "./Icon";
import { time } from "../utils/time";
export function TrackSelector({
  tracks,
  onSelect,
  onClose,
}: {
  tracks: Track[];
  onSelect: (t: Track) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const ready = tracks.filter((t) => t.isPrepared);
  return (
    <dialog
      className="track-sheet"
      aria-labelledby="track-selector-title"
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-content">
        <div className="sheet-grip" />
        <header>
          <div>
            <p className="eyebrow">{copy["NEXT UP"]}</p>
            <h2 id="track-selector-title">{copy["Select Track"]}</h2>
          </div>
          <button
            className="icon-button"
            aria-label={copy["Close track selector"]}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {!ready.length ? (
          <p className="hint">
            {copy["还没有准备好的歌曲。先在 Battle Music 中保存一个 Segment。"]}
          </p>
        ) : (
          [false, true].map((played) => {
            const group = ready.filter((t) => t.playedCount > 0 === played);
            return (
              group.length > 0 && (
                <div key={String(played)}>
                  <p className="sheet-label">
                    {played ? copy["PLAYED"] : copy["AVAILABLE"]}{" "}
                    <span>{group.length}</span>
                  </p>
                  {group.map((t) => (
                    <button
                      key={t.id}
                      className={`selector-row ${played ? "played" : ""}`}
                      onClick={() => onSelect(t)}
                    >
                      <TrackArtwork track={t} />
                      <div className="track-info">
                        <strong>{t.title}</strong>
                        <span>
                          {time(t.segmentStart!, true)} →{" "}
                          {time(t.segmentEnd!, true)}
                        </span>
                        <small>
                          {played
                            ? copy["✓ Played"]
                            : labels.segmentDuration(
                                (t.segmentEnd! - t.segmentStart!).toFixed(1),
                              )}
                        </small>
                      </div>
                      <Icon name="plus" size={20} />
                    </button>
                  ))}
                </div>
              )
            );
          })
        )}
      </div>
    </dialog>
  );
}
