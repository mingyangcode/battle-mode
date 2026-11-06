import { installDemoLibrary } from "./utils/demoLibrary";
import { PAGE_SWIPE_IGNORE, swipeDestination } from "./state/pageSwipe";
import { ThemeToggle } from "./components/ThemeToggle";
import { CoachMarks } from "./components/CoachMarks";
import { collapseTrack } from "./utils/motion";
import { copy, displayError } from "./copy/zh-CN";
import {
  prepareTrack,
  removePreparation,
  prioritizePreparation,
  getPreparation,
} from "./state/autoAnalysis";
import { peaks } from "./utils/time";
import {
  withoutTrack,
  restoreTrack,
  UNDO_MILLISECONDS,
} from "./state/deletion";
import { useEffect, useState, useRef } from "react";
import type { Track } from "./types/track";
import type { RoundHistoryItem } from "./types/round";
import { BattleMusicPage } from "./pages/BattleMusicPage";
import { SegmentEditorPage } from "./pages/SegmentEditorPage";
import { LiveRoundPage } from "./pages/LiveRoundPage";
import { Icon } from "./components/Icon";
import { audio } from "./audio/AudioEngine";
import {
  readTracks,
  readFile,
  saveTrack,
  readDuration,
  finishRound,
  removeTrack,
  patchTrack,
} from "./utils/storage";
export function App() {
  const [page, setPage] = useState<"music" | "live">("music"),
    [editing, setEditing] = useState<Track>(),
    [tracks, setTracks] = useState<Track[]>([]),
    [busy, setBusy] = useState(false),
    [boot, setBoot] = useState(true),
    [active, setActive] = useState(false),
    [error, setError] = useState("");
  const pageGesture = useRef<{ x: number; y: number; id: number } | undefined>(
    undefined,
  );
  const [removed, setRemoved] = useState<{
    track: Track;
    file: Blob;
    index: number;
  }>();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const deleting = useRef(new Set<string>());
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  async function deleteTrack(t: Track) {
    if (active || deleting.current.has(t.id)) return;
    deleting.current.add(t.id);
    try {
      const snapshot = await removeTrack(t.id);
      removePreparation(t.id);
      clearTimeout(undoTimer.current);
      await collapseTrack(t.id);
      setRemoved({
        ...snapshot,
        index: tracks.findIndex((x) => x.id === t.id),
      });
      setTracks((ts) => withoutTrack(ts, t.id));
      undoTimer.current = setTimeout(
        () => setRemoved(undefined),
        UNDO_MILLISECONDS,
      );
    } catch (e) {
      setError(displayError(e));
    } finally {
      deleting.current.delete(t.id);
    }
  }
  async function undoDelete() {
    if (!removed) return;
    clearTimeout(undoTimer.current);
    const item = removed;
    try {
      await saveTrack(item.track, item.file);
      prepareTrack(item.track);
      setTracks((ts) => restoreTrack(ts, item.track, item.index));
      setRemoved((current) =>
        current?.track.id === item.track.id ? undefined : current,
      );
    } catch (e) {
      setError(displayError(e));
    }
  }
  useEffect(() => {
    readTracks()
      .then((ts) => {
        setTracks(ts);
        ts.forEach(prepareTrack);
      })
      .catch((e) => setError(displayError(e)))
      .finally(() => setBoot(false));
    void installDemoLibrary()
      .then(() => readTracks())
      .then((ts) => {
        setTracks(ts);
        ts.forEach(prepareTrack);
      })
      .catch((e) => setError(displayError(e)));
  }, []);
  const waveQueue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    prioritizePreparation(editing?.id);
    return () => prioritizePreparation(undefined);
  }, [editing?.id]);
  async function importFiles(files: File[]) {
    if (busy) return;
    setBusy(true);
    setError("");
    const errors: string[] = [];
    for (const file of files) {
      try {
        const duration = await readDuration(file);
        const track: Track = {
          id: crypto.randomUUID(),
          title: file.name.replace(/\.[^.]+$/, ""),
          duration,
          preRoll: 5,
          roundDuration: 45,
          segmentStart: 0,
          segmentEnd: Math.min(45, duration),
          mode: "same",
          isPrepared: false,
          playedCount: 0,
        };
        await saveTrack(track, file);
        setTracks((t) => [...t, track]);
        prepareTrack(track);
        // One transient decode at a time; no library-wide retained AudioBuffers.
        waveQueue.current = waveQueue.current
          .then(async () => {
            const b = await audio.decode(file);
            const waveformPeaks = peaks(
              b,
              Math.min(4000, Math.max(720, Math.ceil(b.duration * 12))),
            );
            await patchTrack(track.id, { waveformPeaks });
            setTracks((ts) =>
              ts.map((t) => (t.id === track.id ? { ...t, waveformPeaks } : t)),
            );
          })
          .catch(() => {});
      } catch (e) {
        errors.push(`${file.name}：${displayError(e)}`);
      }
    }
    setError(errors.join(" "));
    setBusy(false);
  }
  async function load(track: Track) {
    try {
      return await audio.decode(await readFile(track.id));
    } catch {
      throw new Error(
        copy["音频解码失败。请尝试 MP3 / WAV，或重新导入完整音频文件。"],
      );
    }
  }
  async function save(track: Track) {
    track = {
      ...track,
      analysis: getPreparation(track.id).result ?? track.analysis,
    };
    await saveTrack(track);
    setTracks((ts) => ts.map((t) => (t.id === track.id ? track : t)));
    setEditing(undefined);
  }
  async function complete(track: Track, history: RoundHistoryItem) {
    await finishRound(track, history);
    setTracks(await readTracks());
  }
  function navigate(next: "music" | "live") {
    if (!active) audio.stop();
    setEditing(undefined);
    setPage(next);
    setError("");
  }
  return (
    <div
      className={`app ${editing ? "app-editor" : "has-bottom-nav"} ${page === "live" && !editing ? "app-live" : ""} ${active ? "round-active" : ""}`}
    >
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("music");
          }}
        >
          <span className="brand-mark">
            <Icon name="play" size={18} />
          </span>
          {copy["Battle Mode"]}
        </a>
        <CoachMarks
          key={editing ? "editor" : page}
          page={editing ? "editor" : page}
          disabled={active || boot}
        />
        <ThemeToggle />
      </header>
      {!editing && (
        <nav className="bottom-nav" aria-label={copy["Main navigation"]}>
          <button
            aria-current={page === "music" ? "page" : undefined}
            onClick={() => navigate("music")}
          >
            <Icon name="music" size={18} />
            {copy["Battle Music"]}
          </button>
          <button
            aria-current={page === "live" ? "page" : undefined}
            onClick={() => navigate("live")}
          >
            <Icon name="play" size={18} />
            {copy["Live Round"]}
          </button>
        </nav>
      )}
      <main
        className="app-main"
        onPointerDown={(e) => {
          if (
            editing ||
            e.button !== 0 ||
            (e.target as Element).closest(PAGE_SWIPE_IGNORE) ||
            document.querySelector('[data-queue-open="true"]')
          )
            return;
          pageGesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.style.transition = "none";
        }}
        onPointerMove={(e) => {
          const g = pageGesture.current;
          if (!g || g.id !== e.pointerId) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (
            Math.abs(dx) > Math.abs(dy) * 1.4 &&
            ((page === "music" && dx < 0) || (page === "live" && dx > 0))
          ) {
            const x = Math.max(
              -innerWidth * 0.25,
              Math.min(innerWidth * 0.25, dx * 0.35),
            );
            e.currentTarget.style.transform = `translateX(${x}px)`;
          }
        }}
        onPointerUp={(e) => {
          e.currentTarget.style.transition = matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches
            ? "none"
            : "transform 200ms ease-out";
          e.currentTarget.style.transform = "";
          const g = pageGesture.current;
          pageGesture.current = undefined;
          if (!g || g.id !== e.pointerId) return;
          const target = swipeDestination(
            page,
            e.clientX - g.x,
            e.clientY - g.y,
          );
          if (target) navigate(target);
        }}
        onPointerCancel={(e) => {
          pageGesture.current = undefined;
          e.currentTarget.style.transition = matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches
            ? "none"
            : "transform 200ms ease-out";
          e.currentTarget.style.transform = "";
        }}
      >
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {boot ? (
          <div className="loading">{copy["正在读取本地曲库…"]}</div>
        ) : editing ? (
          <SegmentEditorPage
            key={editing.id}
            track={editing}
            load={load}
            onSave={save}
            onBack={() => setEditing(undefined)}
          />
        ) : page === "music" ? (
          <BattleMusicPage
            tracks={tracks}
            busy={busy}
            onImport={importFiles}
            onEdit={(t) =>
              active ? setError("请先结束播放，再编辑片段。") : setEditing(t)
            }
            onDelete={deleteTrack}
          />
        ) : null}
        {!boot && (
          <div hidden={!!editing || page !== "live"}>
            <LiveRoundPage
              visible={!editing && page === "live"}
              tracks={tracks}
              load={load}
              onComplete={complete}
              onActive={setActive}
            />
          </div>
        )}
      </main>
      {removed && (
        <div className="undo-snackbar" role="status">
          <span>{copy["Track removed"]}</span>
          <button onClick={undoDelete}>{copy["UNDO"]}</button>
        </div>
      )}
    </div>
  );
}
