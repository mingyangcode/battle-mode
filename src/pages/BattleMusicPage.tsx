import { PrimaryPageAction } from "../components/PrimaryPageAction";
import { TrackArtwork } from "../components/TrackArtwork";
import { copy, labels } from "../copy/zh-CN";
import {
  subscribePreparation,
  getPreparation,
  preparationLabel,
} from "../state/autoAnalysis";
import { SwipeTrack } from "../components/SwipeTrack";
import { useRef, useSyncExternalStore } from "react";
import type { Track } from "../types/track";
import { Icon } from "../components/Icon";
import { time } from "../utils/time";
function PreparationStatus({ id }: { id: string }) {
  const s = useSyncExternalStore(subscribePreparation, () =>
    getPreparation(id),
  );
  return (
    <small
      key={s.status}
      className={`preparation-status ${s.status}`}
      role="status"
    >
      {preparationLabel(s.status)}
    </small>
  );
}
export function BattleMusicPage({
  tracks,
  onEdit,
  onImport,
  busy,
  onDelete,
}: {
  tracks: Track[];
  onEdit: (track: Track) => void;
  onImport: (files: File[]) => void;
  busy: boolean;
  onDelete: (track: Track) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const ready = tracks.filter((t) => t.isPrepared).length;
  return (
    <section className="library">
      <PrimaryPageAction guide="add" disabled={busy} onClick={() => input.current?.click()} label={busy ? copy["Importing…"] : copy["Add Tracks"]} />
        <input
          ref={input}
          hidden
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          multiple
          onChange={(e) => {
            onImport(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      <div className="section-label">
        <h3>
          {copy["YOUR TRACKS"]}
          <span>{tracks.length.toString().padStart(2, "0")}</span>
        </h3>
        <span>
          {ready}
          {copy["ready for battle"]}
        </span>
      </div>
      {!tracks.length ? (
        <div className="empty-library">
          <Icon name="music" size={44} />
          <h2>{copy["从第一首音乐开始"]}</h2>
          <p>{copy["添加本地 MP3、WAV 或其他浏览器支持的音频。"]}</p>

        </div>
      ) : (
        <div className="track-list">
          {tracks.map((t) => (
            <SwipeTrack
              key={t.id}
              trackId={t.id}
              title={t.title}
              onOpen={() => onEdit(t)}
              onDelete={() => onDelete(t)}
            >
              <TrackArtwork track={t} />
              <div className="track-info">
                <strong>{t.title}</strong>
                <span>
                  {t.artist || copy["Local audio"]} <i>·</i> {time(t.duration)}
                </span>
                <small className={t.isPrepared ? "prepared" : ""}>
                  {t.isPrepared
                    ? labels.readyDuration(
                        ((t.segmentEnd ?? 0) - (t.segmentStart ?? 0)).toFixed(
                          1,
                        ),
                      )
                    : copy["Not Prepared"]}
                </small>
                <PreparationStatus id={t.id} />
              </div>
              <Icon name="arrow" size={18} />
            </SwipeTrack>
          ))}
        </div>
      )}
      <p className="local-note">{copy["音乐与片段设置仅保存在此浏览器"]}</p>
    </section>
  );
}
