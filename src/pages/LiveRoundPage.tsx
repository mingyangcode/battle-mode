import { UpcomingQueue } from "../components/UpcomingQueue";
import {
  enqueue,
  removeQueued,
  reorderQueued,
  pruneQueue,
  promoteHead,
  type LiveQueueState,
} from "../state/liveQueue";
import { PrimaryPageAction } from "../components/PrimaryPageAction";
import { WaterRippleVisualizer } from "../components/WaterRippleVisualizer";
import { QueuePreload } from "../state/queuePreload";
import { copy, labels, displayError } from "../copy/zh-CN";
import { deriveSequential } from "../state/sequential";
import { useEffect, useRef, useState } from "react";
import type { Track } from "../types/track";
import type { RoundState, RoundHistoryItem } from "../types/round";
import { audio } from "../audio/AudioEngine";
import { TrackSelector } from "../components/TrackSelector";
import { FullTrackTimeline } from "../components/FullTrackTimeline";
import { Icon } from "../components/Icon";
import { time } from "../utils/time";
export function LiveRoundPage({
  tracks,
  visible = true,
  load,
  onComplete,
  onActive,
}: {
  tracks: Track[];
  visible?: boolean;
  load: (t: Track) => Promise<AudioBuffer>;
  onComplete: (t: Track, h: RoundHistoryItem) => Promise<void>;
  onActive: (active: boolean) => void;
}) {
  const next = useRef(new QueuePreload<Track, AudioBuffer>());
  const [, refreshNext] = useState(0);
  const [nextSheet, setNextSheet] = useState(false);
  const [queue, setQueue] = useState<LiveQueueState>({ items: [] });
  const [paused, setPaused] = useState(false);
  const [transportBusy, setTransportBusy] = useState(false);
  const [round, setRound] = useState<RoundState>({ phase: "SELECT_TRACK" }),
    [sheet, setSheet] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [position, setPosition] = useState(0),
    [remaining, setRemaining] = useState<number>(),
    [incoming, setIncoming] = useState(false),
    [suspended, setSuspended] = useState(false),
    [saving, setSaving] = useState(false);
  const buffer = useRef<AudioBuffer | undefined>(undefined),
    history = useRef<RoundHistoryItem | undefined>(undefined),
    selection = useRef(0),
    starting = useRef(false),
    finishing = useRef(false),
    mounted = useRef(true);
  const selectedTrack = useRef<Track | undefined>(undefined);
  const track =
    tracks.find((t) => t.id === round.selectedTrackId) ??
    (selectedTrack.current?.id === round.selectedTrackId
      ? selectedTrack.current
      : undefined);
  const active = !["SELECT_TRACK", "READY"].includes(round.phase);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      selection.current++;
      next.current.clear();
      audio.stop();
      onActive(false);
    };
  }, []);
  const head = queue.items[0];
  useEffect(() => {
    const candidate = tracks.find(
      (t) => t.id === head?.trackId && t.isPrepared,
    );
    if (!head || !candidate) {
      next.current.clear();
      refreshNext((v) => v + 1);
      return;
    }
    const pending = next.current.select(head.id, candidate, load);
    refreshNext((v) => v + 1);
    void pending.then(() => {
      if (mounted.current) refreshNext((v) => v + 1);
    });
  }, [head?.id, head?.trackId, tracks]);
  function chooseNext(t: Track) {
    setQueue((q) =>
      enqueue(q, {
        id: crypto.randomUUID(),
        trackId: t.id,
        createdAt: Date.now(),
      }),
    );
  }
  useEffect(() => {
    setQueue((q) =>
      pruneQueue(
        q,
        new Set(tracks.filter((t) => t.isPrepared).map((t) => t.id)),
      ),
    );
  }, [tracks]);
  async function select(t: Track) {
    const request = ++selection.current;
    selectedTrack.current = t;
    setSheet(false);
    setError("");
    setLoading(true);
    setPaused(false);
    setIncoming(false);
    setRemaining(undefined);
    buffer.current = undefined;
    audio.stop();
    setPosition(Math.max(0, t.segmentStart! - t.preRoll));
    setRound({ phase: "READY", selectedTrackId: t.id });
    try {
      const decoded = await load(t);
      if (request === selection.current && mounted.current)
        buffer.current = decoded;
    } catch (e) {
      if (request === selection.current) setError(displayError(e));
    } finally {
      if (request === selection.current) setLoading(false);
    }
  }
  async function saveHistory() {
    const h = history.current,
      current = selectedTrack.current;
    if (!h || !current) return;
    await onComplete(
      { ...current, playedCount: current.playedCount + 1 },
      { ...h, endedAt: Date.now() },
    );
    if (history.current?.id === h.id) history.current = undefined;
  }
  async function transition() {
    if (starting.current || paused || round.phase !== "JUDGING") return;
    const head = queue.items[0];
    if (!head) {
      setNextSheet(true);
      return;
    }
    const prepared = next.current.buffer,
      candidate = next.current.track;
    if (next.current.id !== head.id || !prepared || !candidate) return;
    starting.current = true;
    setTransportBusy(true);
    setError("");
    try {
      await saveHistory();
      if (!mounted.current || next.current.id !== head.id) return;
      if (!(await audio.transitionToNextRound(prepared, {
        segmentStart: candidate.segmentStart!, segmentEnd: candidate.segmentEnd!, preRoll: 5,
      }, { mode: candidate.mode, postRoll: candidate.postRoll ?? 5,
        segmentB: candidate.mode === "matched" ? candidate.segmentB : undefined,
        analysis: candidate.analysis }))) return;
      buffer.current = prepared;
      selectedTrack.current = candidate;
      setQueue((q) => promoteHead(q, head.id));
      history.current = { id: crypto.randomUUID(), trackId: candidate.id, startedAt: Date.now() };
      setRound({ phase: audio.snapshot().phase, selectedTrackId: candidate.id });
      setIncoming(false);
      setRemaining(undefined);
      setPosition(audio.snapshot().position);
    } catch (e) {
      setError(displayError(e));
    } finally {
      starting.current = false;
      setTransportBusy(false);
    }
  }
  async function complete() {
    if (finishing.current) return;
    finishing.current = true;
    setSaving(true);
    try {
      await saveHistory();
      audio.stop();
      buffer.current = undefined;
      history.current = undefined;
      selectedTrack.current = undefined;
      setRound({ phase: "SELECT_TRACK" });
      setPosition(audio.snapshot().position);
      setPaused(false);
      setRemaining(undefined);
      setIncoming(false);
      setNextSheet(false);
      onActive(false);
      setError("");
    } catch (e) {
      setError(displayError(e));
    } finally {
      finishing.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!active) return;
    let frame: number;
    const update = () => {
      const s = audio.snapshot();
      setPosition(s.position);
      setRemaining(s.remaining);
      setIncoming(!!s.incoming);
      setPaused(audio.paused);
      setSuspended(audio.suspended);
      setRound((r) => (r.phase === s.phase ? r : { ...r, phase: s.phase }));
      if (history.current && !audio.paused) {
        const h = history.current;
        const schedule = audio.roundTiming();
        if (schedule) {
          const now = audio.ctx.currentTime;
          if (now >= schedule.a && !h.dancerAStartedAt)
            h.dancerAStartedAt = Date.now() - (now - schedule.a) * 1000;
          const bStart = schedule.bPerformance ?? schedule.b;
          if (now >= bStart && !h.dancerBStartedAt)
            h.dancerBStartedAt = Date.now() - (now - bStart) * 1000;
          if (now >= schedule.judging && !h.judgingStartedAt)
            h.judgingStartedAt = Date.now() - (now - schedule.judging) * 1000;
        }
      }
      if (s.finished) {
        void complete();
        return;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [active, track?.id]);
  useEffect(() => {
    if (!active) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const hide = () => {
      audio.stop();
      buffer.current = undefined;
      history.current = undefined;
      setRound({ phase: "SELECT_TRACK" });
      onActive(false);
    };
    window.addEventListener("beforeunload", before);
    window.addEventListener("pagehide", hide);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("pagehide", hide);
    };
  }, [active]);
  async function start() {
    const background = round.phase === "INTER_ROUND_BG";
    if (
      starting.current ||
      (active && !background) ||
      paused ||
      !buffer.current ||
      !track
    )
      return;
    starting.current = true;
    setError("");
    onActive(true);
    try {
      const segment = {
        segmentStart: track.segmentStart!,
        segmentEnd: track.segmentEnd!,
        preRoll: track.preRoll,
      };
      const options = {
        mode: track.mode,
        postRoll: track.postRoll ?? 5,
        segmentB: track.mode === "matched" ? track.segmentB : undefined,
        analysis: track.analysis,
      };
      if (background) await audio.startFromBackground(segment, options);
      else await audio.start(buffer.current, segment, options);
      if (!mounted.current) return;
      history.current = {
        id: crypto.randomUUID(),
        trackId: track.id,
        startedAt: Date.now(),
      };
      setRound((r) => ({ ...r, phase: audio.snapshot().phase }));
    } catch (e) {
      setError(displayError(e));
      if (!background) onActive(false);
    } finally {
      starting.current = false;
    }
  }
  async function transport(action: "pause" | "replay") {
    if (starting.current) return;
    starting.current = true;
    setTransportBusy(true);
    setError("");
    try {
      if (action === "replay") {
        await audio.replayRound();
        if (history.current)
          history.current = {
            id: history.current.id,
            trackId: history.current.trackId,
            startedAt: Date.now(),
          };
      } else if (audio.paused) await audio.resumeRound();
      else audio.pauseRound();
      setPaused(audio.paused);
    } catch (e) {
      setError(displayError(e));
    } finally {
      starting.current = false;
      setTransportBusy(false);
    }
  }
  const phase = round.phase;
  const interRound = phase === "INTER_ROUND_BG";
  const crossing = phase === "TRANSITION_TO_NEXT";
  const bPre = phase === "PRE_B" || phase === "TRANSITION";
  const aPre = phase === "PRE_A" || phase === "PRE";
  const continuation =
    track?.mode === "sequential"
      ? deriveSequential(
          track.segmentStart!,
          track.segmentEnd! - track.segmentStart!,
          track.preRoll,
          track.postRoll ?? 5,
        )
      : undefined;
  const visibleSegment =
    incoming && continuation
      ? continuation.b
      : incoming && track?.mode === "matched" && track.segmentB
        ? track.segmentB
        : { start: track?.segmentStart ?? 0, end: track?.segmentEnd ?? 0 };
  const label = crossing
    ? "正在过渡"
    : interRound
      ? "轮间音乐"
      : aPre || bPre
        ? copy["GET READY"]
        : phase === "DANCER_A"
          ? copy["DANCER A"]
          : phase === "DANCER_B"
            ? copy["DANCER B"]
            : phase === "POST_B"
              ? copy["WRAP UP"]
              : phase === "JUDGING"
                ? labels.judging
                : phase === "END_ROUND"
                  ? copy["ENDING ROUND"]
                  : phase === "READY"
                    ? copy["READY TO BATTLE"]
                    : copy["NEW ROUND"];
  return (
    <section
      data-queue-open={nextSheet}
      className={`live ${nextSheet ? "queue-split" : ""} ${phase === "SELECT_TRACK" ? "live-idle" : ""} ${active ? "is-playing" : ""}`}
    >
      <div className="live-monitor">
        {visible && (
          <WaterRippleVisualizer
            active={active && phase !== "END_ROUND"}
            paused={paused}
            phase={phase}
          />
        )}
        <div className="live-status">
          {phase === "SELECT_TRACK" && <Icon name="music" size={40} />}
          {phase !== "SELECT_TRACK" && (
            <p className="eyebrow">
              {aPre || bPre
                ? labels.listen(bPre ? "B" : "A")
                : phase === "JUDGING"
                  ? copy["THE MUSIC KEEPS GOING"]
                  : copy["BATTLE MODE"]}
            </p>
          )}
          <h1 className="phase-label" key={label} aria-live="polite">
            {label}
          </h1>
          {paused && (
            <p className="status-caption" role="status">
              已暂停
            </p>
          )}
          {active && remaining !== undefined && phase !== "END_ROUND" && (
            <div
              className="phase-countdown"
              aria-label={copy["Phase time remaining"]}
            >
              {time(Math.max(0, Math.ceil(remaining - 1e-6)))}
            </div>
          )}
        </div>
        {track ? (
          <div className="live-track">
            <div className="live-song">
              <div>
                <h2>{track.title}</h2>
                <p>
                  {track.artist || copy["Local audio"]} · {time(track.duration)}
                </p>
              </div>
              <span className="segment-tag">
                {(track.segmentEnd! - track.segmentStart!).toFixed(1)}
                {copy["s"]}
              </span>
            </div>
            <FullTrackTimeline
              duration={buffer.current?.duration ?? track.duration}
              peaks={track.waveformPeaks}
              continuation={continuation}
              segmentStart={continuation?.a.start ?? visibleSegment.start}
              segmentEnd={continuation?.a.end ?? visibleSegment.end}
              preRoll={track.preRoll}
              position={position}
            />
            <div className="live-track-footer">
              <span>
                {phase === "JUDGING"
                  ? copy["VOLUME · 30%"]
                  : track.mode === "sequential"
                    ? labels.modeDancer("sequential", incoming ? "B" : "A")
                    : track.mode === "matched"
                      ? labels.modeDancer("matched", incoming ? "B" : "A")
                      : copy["SAME SEGMENT · BOTH DANCERS"]}
              </span>
              <span>
                {phase === "DANCER_A" ||
                phase === "DANCER_B" ||
                phase === "TRANSITION"
                  ? `${time(Math.max(0, position - visibleSegment.start))} / ${time(track.segmentEnd! - track.segmentStart!)}`
                  : `${time(visibleSegment.start, true)} — ${time(visibleSegment.end, true)}`}
              </span>
            </div>
          </div>
        ) : null}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {suspended && active && !paused && (
          <button
            className="secondary"
            onClick={() =>
              audio
                .resume()
                .then(() => setSuspended(false))
                .catch((e) => setError(displayError(e)))
            }
          >
            {copy["音频被浏览器暂停 · 点击恢复"]}
          </button>
        )}
        <div
          data-guide={phase === "SELECT_TRACK" ? undefined : "live"}
          className="live-actions"
        >
          {phase === "SELECT_TRACK" ? (
            visible && (
              <PrimaryPageAction
                guide="live"
                label={copy["Select Track"]}
                onClick={() => setSheet(true)}
                caption={`已准备 ${tracks.filter((t) => t.isPrepared).length} 首音乐`}
              />
            )
          ) : phase === "READY" ? (
            <>
              <button
                className="primary"
                disabled={loading || !buffer.current}
                onClick={start}
              >
                <Icon name="play" />
                {loading ? copy["Preparing audio…"] : copy["START ROUND"]}
              </button>
              <button className="text-button" onClick={() => setSheet(true)}>
                {copy["Change Track"]}
              </button>
              {error && (
                <button className="text-button" onClick={() => select(track!)}>
                  {copy["Retry Loading"]}
                </button>
              )}
            </>
          ) : (
            <div className="transport-controls">
              <button
                className="primary"
                disabled={phase === "END_ROUND" || crossing || transportBusy}
                onClick={() => transport("pause")}
              >
                {paused ? "继续" : "暂停"}
              </button>
              <button
                className="secondary"
                disabled={
                  phase === "END_ROUND" ||
                  crossing ||
                  transportBusy ||
                  (interRound && paused)
                }
                onClick={() => (interRound ? start() : transport("replay"))}
              >
                {interRound ? "开始" : "重播"}
              </button>
              <button
                className="end-round"
                disabled={
                  transportBusy ||
                  phase !== "JUDGING" ||
                  paused ||
                  (!!queue.items.length &&
                    (!next.current.buffer || next.current.loading))
                }
                onClick={transition}
              >
                {crossing
                  ? "过渡中…"
                  : phase === "JUDGING" && next.current.loading
                    ? "准备中…"
                    : "过渡"}
              </button>
            </div>
          )}

          {active && (
            <button
              className="text-button end-session"
              disabled={
                transportBusy || (phase === "END_ROUND" && (!error || saving))
              }
              onClick={() => (phase === "END_ROUND" ? complete() : audio.end())}
            >
              {phase === "END_ROUND"
                ? error
                  ? copy["Retry Save"]
                  : copy["Ending…"]
                : "结束播放"}
            </button>
          )}
        </div>
      </div>
      {active &&
        phase !== "END_ROUND" &&
        !nextSheet && (
          <button
            className="secondary queue-open"
            onClick={() => setNextSheet(true)}
          >
            后续轮次 · {queue.items.length} 首　＋
          </button>
        )}
      {nextSheet && (
        <UpcomingQueue
          preparation={
            next.current.loading
              ? "正在预加载下一首…"
              : next.current.error
                ? "下一首加载失败，请移除后重新选择"
                : next.current.buffer
                  ? "下一首已准备"
                  : undefined
          }
          items={queue.items}
          tracks={tracks}
          onAdd={chooseNext}
          onRemove={(id) => {
            if (!starting.current) setQueue((q) => removeQueued(q, id));
          }}
          onMove={(id, i) => {
            if (!starting.current) setQueue((q) => reorderQueued(q, id, i));
          }}
          onClose={() => setNextSheet(false)}
        />
      )}
      {sheet && (
        <TrackSelector
          tracks={tracks}
          onSelect={select}
          onClose={() => setSheet(false)}
        />
      )}
    </section>
  );
}
