import { TrackArtwork } from "../components/TrackArtwork";
import { copy, labels, displayError } from "../copy/zh-CN";
import {
  clampSequential,
  deriveSequential,
  sequentialMaxStart,
  modeDefaults,
  CONTINUE_ERROR,
} from "../state/sequential";
import { useEffect, useRef, useState } from "react";
import { AnalysisSuggestions } from "../components/AnalysisSuggestions";
import {
  applyRecommendation,
  applyPair,
  type SegmentMode,
} from "../state/segmentModes";
import type { Track } from "../types/track";
import { audio } from "../audio/AudioEngine";
import { FullTrackTimeline } from "../components/FullTrackTimeline";
import { EditorPlayhead } from "../components/EditorPlayhead";
import { time, peaks } from "../utils/time";
import {
  clamp,
  durationError,
  lockDuration,
  moveBoundary,
  focusedViewport,
  previewRange,
  type Selection,
  type Viewport,
} from "../state/segmentEditor";
export function SegmentEditorPage({
  track,
  load,
  onSave,
  onBack,
}: {
  track: Track;
  load: (t: Track) => Promise<AudioBuffer>;
  onSave: (t: Track) => Promise<void>;
  onBack: () => void;
}) {
  const defaults = modeDefaults(track);
  const postRoll = defaults.postRoll;
  const initial = {
    start: track.segmentStart ?? Math.min(5, track.duration / 5),
    end: track.segmentEnd ?? Math.min(track.duration, 45),
  };
  const [mode, setMode] = useState<SegmentMode>(defaults.mode);
  const [continueView, setContinueView] = useState<"a" | "b">("a");
  const [tab, setTab] = useState<"a" | "b">("a");
  const [other, setOther] = useState<Selection>(track.segmentB ?? initial);
  const [analysis, setAnalysis] = useState(track.analysis);
  const [buffer, setBuffer] = useState<AudioBuffer>(),
    [selection, setSelection] = useState<Selection>(initial),
    [wave, setWave] = useState(track.waveformPeaks),
    [error, setError] = useState(""),
    [durationText, setDurationText] = useState(
      track.roundDuration?.toString() ??
        (defaults.mode === "sequential"
          ? String(initial.end - initial.start)
          : ""),
    ),
    [position, setPosition] = useState(initial.start),
    [playing, setPlaying] = useState(false),
    [pending, setPending] = useState(false),
    [saving, setSaving] = useState(false),
    [view, setView] = useState<Viewport>(),
    [previewKind, setPreviewKind] = useState<"start" | "end" | "free">("free"),
    [suspended, setSuspended] = useState(false);
  const dragging = useRef(false),
    boundaryDragging = useRef(false),
    request = useRef(0),
    selected = useRef(selection),
    positionRef = useRef(position),
    mounted = useRef(false);
  selected.current = selection;
  positionRef.current = position;
  const duration = buffer?.duration ?? track.duration,
    validation =
      durationError(durationText, duration) ||
      (mode !== "same" && !durationText.trim()
        ? copy["此模式需要填写固定 Round Duration。"]
        : "") ||
      (mode === "sequential" &&
      sequentialMaxStart(
        duration,
        Number(durationText),
        track.preRoll,
        postRoll,
      ) < 0
        ? CONTINUE_ERROR
        : "");
  const locked =
    durationText.trim() !== "" && !validation
      ? Number(durationText)
      : undefined;
  const continuation =
    mode === "sequential"
      ? deriveSequential(
          selection.start,
          locked ?? selection.end - selection.start,
          track.preRoll,
          postRoll,
        )
      : undefined;
  const editableEnd =
    mode === "sequential"
      ? Math.max(
          0,
          duration -
            (locked ?? selection.end - selection.start) -
            track.preRoll -
            postRoll,
        )
      : duration;
  const range = view ?? { start: 0, end: duration };
  function focusRange(s: Selection) {
    return focusedViewport(
      {
        start: s.start,
        end:
          mode === "sequential"
            ? Math.min(
                duration,
                deriveSequential(
                  s.start,
                  s.end - s.start,
                  track.preRoll,
                  postRoll,
                ).postEnd,
              )
            : s.end,
      },
      duration,
    );
  }
  function setHead(n: number) {
    positionRef.current = n;
    setPosition(n);
  }
  function pause() {
    request.current++;
    const p = audio.pausePreview();
    setPending(false);
    setPlaying(false);
    setSuspended(false);
    if (p !== undefined && !dragging.current) setHead(p);
  }
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    load(track)
      .then((b) => {
        if (cancelled) return;
        setBuffer(b);
        setWave(
          peaks(b, Math.min(4000, Math.max(720, Math.ceil(b.duration * 12)))),
        );
        const s = {
          start: clamp(initial.start, 0, b.duration - 0.5),
          end: Math.min(initial.end, b.duration),
        };
        let next =
          track.roundDuration && track.roundDuration <= b.duration
            ? lockDuration(s, track.roundDuration, b.duration)
            : s;
        if (defaults.mode === "sequential") {
          try {
            next = clampSequential(
              next.start,
              next.end - next.start,
              b.duration,
              track.preRoll,
              postRoll,
            ).a;
          } catch {
            setError(CONTINUE_ERROR);
          }
        }
        setSelection(next);
        setOther(
          lockDuration(
            track.segmentB ?? next,
            next.end - next.start,
            b.duration,
          ),
        );
        setHead(next.start);
      })
      .catch((e) => !cancelled && setError(displayError(e)));
    return () => {
      cancelled = true;
      mounted.current = false;
      request.current++;
      audio.stop();
    };
  }, [track.id]);
  useEffect(() => {
    if (!playing) return;
    let id: number;
    const tick = () => {
      const snap = audio.previewSnapshot();
      if (!dragging.current && snap.position !== undefined)
        setHead(snap.position);
      setSuspended(snap.suspended);
      if (!snap.playing) {
        setPlaying(false);
        return;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);
  useEffect(() => {
    const hide = () => {
      pause();
    };
    window.addEventListener("pagehide", hide);
    return () => window.removeEventListener("pagehide", hide);
  }, []);
  function apply(next: Selection) {
    pause();
    if (mode === "sequential") {
      try {
        next = clampSequential(
          next.start,
          next.end - next.start,
          duration,
          track.preRoll,
          postRoll,
        ).a;
      } catch {
        setError(CONTINUE_ERROR);
        return;
      }
    }
    setError("");
    selected.current = next;
    setSelection(next);
    if (view && !boundaryDragging.current) setView(focusRange(next));
  }
  function boundary(edge: "start" | "end", value: number) {
    if (mode === "sequential" && validation) return;
    apply(moveBoundary(selected.current, edge, value, editableEnd, locked));
  }
  function changeDuration(value: string) {
    setDurationText(value);
    if (value.trim() !== "" && !durationError(value, duration)) {
      apply(lockDuration(selected.current, Number(value), duration));
      setOther(lockDuration(other, Number(value), duration));
    }
  }
  async function play(
    from: number,
    to: number,
    kind: "start" | "end" | "free",
  ) {
    pause();
    if (!buffer || from >= to) return;
    const token = ++request.current;
    setPending(true);
    setError("");
    setPreviewKind(kind);
    setHead(from);
    try {
      const started = await audio.playRange(buffer, from, to);
      if (token === request.current && mounted.current && started)
        setPlaying(true);
    } catch (e) {
      if (token === request.current && mounted.current)
        setError(displayError(e));
    } finally {
      if (token === request.current && mounted.current) setPending(false);
    }
  }
  function toggle() {
    if (playing || pending) {
      pause();
      return;
    }
    if (positionRef.current >= duration) {
      setError(copy["已到歌曲结尾，请拖动播放头选择播放位置。"]);
      return;
    }
    void play(positionRef.current, duration, "free");
  }
  function preview(kind: "start" | "end") {
    if ((playing || pending) && previewKind === kind) {
      pause();
      return;
    }
    const target =
      continuation && continueView === "b" ? continuation.b : selection;
    const r = previewRange(kind, target, duration, track.preRoll);
    void play(r.start, r.end, kind);
  }
  function switchTab(next: "a" | "b") {
    if (next === tab) return;
    const previous = selection;
    apply(other);
    setOther(previous);
    setTab(next);
    setHead(other.start);
  }
  function switchMode(next: SegmentMode) {
    pause();
    setContinueView("a");
    if (next !== "matched" && tab === "b") switchTab("a");
    if (next === "sequential") {
      const current = tab === "a" ? selection : other;
      const length = locked ?? current.end - current.start;
      setDurationText(String(length));
      try {
        const a = clampSequential(
          current.start,
          length,
          duration,
          track.preRoll,
          postRoll,
        ).a;
        setSelection(a);
        selected.current = a;
        setHead(a.start);
        setError("");
      } catch {
        setError(CONTINUE_ERROR);
      }
      setTab("a");
    }
    if (next === "matched") {
      const length = locked ?? selection.end - selection.start;
      setDurationText(String(length));
      setOther(lockDuration(other, length, duration));
    }
    setMode(next);
  }
  const aSelection = tab === "a" ? selection : other,
    bSelection = tab === "b" ? selection : other;
  const pairError =
    mode === "matched" && Math.abs(aSelection.start - bSelection.start) < 0.001
      ? copy["请为 Dancer B 选择不同位置的片段，或使用 Same Segment。"]
      : "";
  const { start, end } = selection;
  return (
    <section className="editor">
      <button className="back" onClick={onBack}>
        {copy["← Battle Music"]}
      </button>
      <div className="page-title">
        <div>
          <h1>{copy["Segment Editor"]}</h1>
        </div>
      </div>
      <div className="track-heading">
        <TrackArtwork track={track} />
        <div>
          <h2>{track.title}</h2>
          <p>
            {track.artist || copy["Local audio"]} · {time(duration)}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!buffer && !error ? (
        <div className="loading">{copy["正在读取音频与生成整曲波形…"]}</div>
      ) : (
        buffer && (
          <>
            <div
              data-guide="mode"
              className={`mode-control segment-modes mode-${mode}`}
              aria-label={copy["Segment mode"]}
            >
              <button
                aria-pressed={mode === "same"}
                onClick={() => switchMode("same")}
              >
                {copy["Same"]}
              </button>
              <button
                aria-pressed={mode === "matched"}
                onClick={() => switchMode("matched")}
              >
                {copy["Matched"]}
              </button>
              <button
                aria-pressed={mode === "sequential"}
                onClick={() => switchMode("sequential")}
              >
                {copy["Continue"]}
              </button>
            </div>
            <div className="duration-control">
              <label htmlFor="round-duration">
                {copy["Round Duration"]}
                <small>{copy["seconds · 不含 PRE"]}</small>
              </label>
              <div>
                <input
                  id="round-duration"
                  aria-describedby="duration-help"
                  aria-invalid={!!validation}
                  type="number"
                  min="0.5"
                  max={duration}
                  step="0.1"
                  placeholder={(end - start).toFixed(1)}
                  value={durationText}
                  onChange={(e) => changeDuration(e.target.value)}
                />
                <span>
                  {validation
                    ? copy["CHECK DURATION"]
                    : locked !== undefined
                      ? copy["FIXED LENGTH"]
                      : copy["FREE LENGTH"]}
                </span>
              </div>
              <p
                id="duration-help"
                className={validation ? "field-error" : "hint"}
                role={validation ? "alert" : undefined}
              >
                {validation ||
                  (locked !== undefined
                    ? mode !== "same"
                      ? copy["A / B 始终等长，拖动任一端可移动当前片段。"]
                      : copy[
                          "已锁定长度，拖动任一端可移动整个片段。清空可恢复自由编辑。"
                        ]
                    : copy["填写秒数可锁定片段长度；留空时自由编辑。"])}
              </p>
            </div>
            {mode === "matched" && (
              <div
                className="mode-control dancer-tabs"
                aria-label={copy["Edit dancer segment"]}
              >
                <button
                  aria-pressed={tab === "a"}
                  onClick={() => switchTab("a")}
                >
                  {copy["DANCER A"]}
                </button>
                <button
                  aria-pressed={tab === "b"}
                  onClick={() => switchTab("b")}
                >
                  {copy["DANCER B"]}
                </button>
              </div>
            )}
            {continuation && (
              <div className="continue-cards" aria-label="顺延片段">
                <button
                  className="secondary"
                  aria-pressed={continueView === "a"}
                  onClick={() => {
                    pause();
                    setContinueView("a");
                    setHead(continuation.a.start);
                    setView(focusedViewport(continuation.a, duration));
                  }}
                >
                  舞者 A{" "}
                  <small>
                    {time(continuation.a.start, true)} —{" "}
                    {time(continuation.a.end, true)} · 可编辑
                  </small>
                </button>
                <button
                  className="secondary"
                  aria-pressed={continueView === "b"}
                  onClick={() => {
                    pause();
                    setContinueView("b");
                    setHead(continuation.b.start);
                    setView(
                      focusedViewport(
                        {
                          start: continuation.bPreStart,
                          end: continuation.postEnd,
                        },
                        duration,
                      ),
                    );
                  }}
                >
                  舞者 B <small>由舞者 A 自动顺延</small>
                  <small>
                    {time(continuation.b.start, true)} —{" "}
                    {time(continuation.b.end, true)}
                  </small>
                </button>
                {continueView === "b" && (
                  <button
                    className="text-button"
                    onClick={() =>
                      void play(
                        continuation.bPreStart,
                        continuation.postEnd,
                        "free",
                      )
                    }
                  >
                    试听舞者 B · 准备 / 表演 / 收尾
                  </button>
                )}
              </div>
            )}
            <div data-guide="wave" className="panel editor-wave-panel">
              <div className="panel-heading">
                <h3>{copy["Find your moment."]}</h3>
                <button
                  className="focus-button secondary"
                  aria-pressed={!!view}
                  onClick={() =>
                    setView(
                      view
                        ? undefined
                        : continuation && continueView === "b"
                          ? focusedViewport(
                              {
                                start: continuation.bPreStart,
                                end: continuation.postEnd,
                              },
                              duration,
                            )
                          : focusRange(selection),
                    )
                  }
                >
                  {view ? copy["Full Track"] : copy["Focus"]}
                </button>
              </div>
              <FullTrackTimeline
                duration={duration}
                continuation={continuation}
                editableEnd={editableEnd}
                peaks={wave}
                segmentStart={start}
                segmentEnd={end}
                preRoll={track.preRoll}
                editable={!(continuation && continueView === "b")}
                viewport={view}
                roundDuration={locked}
                position={position}
                onBoundary={boundary}
                onEditStart={() => {
                  boundaryDragging.current = true;
                  pause();
                }}
                onEditEnd={() => {
                  boundaryDragging.current = false;
                  if (view) setView(focusRange(selected.current));
                }}
                overlay={
                  <EditorPlayhead
                    position={position}
                    viewport={range}
                    playing={playing || pending}
                    onToggle={toggle}
                    onSeekStart={() => {
                      pause();
                      dragging.current = true;
                    }}
                    onSeek={setHead}
                    onSeekEnd={() => {
                      dragging.current = false;
                    }}
                  />
                }
              />
              {view && (position < view.start || position > view.end) && (
                <p className="playhead-help">
                  {copy[" · 播放头在聚焦区域外，切回 Full Track 可查看。"]}
                </p>
              )}
            </div>
            {suspended && playing && (
              <button
                className="secondary"
                onClick={() =>
                  audio
                    .resume()
                    .then(() => setSuspended(false))
                    .catch((e) => setError(displayError(e)))
                }
              >
                {copy["音频已暂停 · 点击恢复"]}
              </button>
            )}
            <div className="preview-actions">
              {(["start", "end"] as const).map((kind) => (
                <button
                  key={kind}
                  className="secondary"
                  aria-pressed={(playing || pending) && previewKind === kind}
                  onClick={() => preview(kind)}
                >
                  {(playing || pending) && previewKind === kind
                    ? copy["Ⅱ STOP"]
                    : kind === "start"
                      ? copy["▷ START PREVIEW"]
                      : copy["▷ END PREVIEW"]}
                </button>
              ))}
            </div>

            <div className="segment-detail">
              <div>
                <p className="eyebrow">
                  {mode === "sequential"
                    ? copy["DANCER A SEGMENT"]
                    : mode === "matched"
                      ? labels.dancerSegment(tab.toUpperCase())
                      : copy["BATTLE SEGMENT"]}
                </p>
                <h2>
                  {time(start, true)} <span>→</span> {time(end, true)}
                </h2>
              </div>
              <div className="duration-value">
                {(end - start).toFixed(1)}
                <small>{copy["sec"]}</small>
              </div>
            </div>
            {continuation && (
              <p className="hint continuation-summary">
                {copy["PRE B"]}
                {time(continuation.bPreStart, true)} →{" "}
                {time(continuation.b.start, true)}
                {copy["· B"]} {time(continuation.b.start, true)} →{" "}
                {time(continuation.b.end, true)}
                {copy["· POST B →"]} {time(continuation.postEnd, true)}
                {copy["· 自动顺延，无需编辑 B"]}
              </p>
            )}
            <div className="fine-controls">
              <label>
                {copy["Start · 秒"]}
                <input
                  aria-label={copy["Start seconds"]}
                  type="number"
                  min={0}
                  max={locked !== undefined ? editableEnd - locked : end - 0.5}
                  step="0.1"
                  value={start.toFixed(1)}
                  onChange={(e) => boundary("start", Number(e.target.value))}
                />
              </label>
              <label>
                {copy["End · 秒"]}
                <input
                  aria-label={copy["End seconds"]}
                  type="number"
                  min={locked ?? start + 0.5}
                  max={editableEnd}
                  step="0.1"
                  value={end.toFixed(1)}
                  onChange={(e) => boundary("end", Number(e.target.value))}
                />
              </label>
            </div>
            {end >= duration - 5 && (
              <p className="hint">
                {copy["片段接近原曲结尾，可留出更多 Judging 背景音乐。"]}
              </p>
            )}
            {pairError && (
              <p className="hint" role="status">
                {pairError}
              </p>
            )}
            <AnalysisSuggestions
              trackId={track.id}
              length={validation ? NaN : (locked ?? end - start)}
              mode={mode}
              preRoll={track.preRoll}
              postRoll={postRoll}
              result={analysis}
              onResult={setAnalysis}
              onApply={(r) => {
                try {
                  apply(
                    applyRecommendation(r, editableEnd, locked ?? end - start),
                  );
                } catch (e) {
                  setError(displayError(e));
                }
              }}
              onPair={(p) => {
                try {
                  const pair = applyPair(p, duration, locked ?? end - start);
                  apply(pair.a);
                  setOther(pair.b);
                  setTab("a");
                  setHead(pair.a.start);
                } catch (e) {
                  setError(displayError(e));
                }
              }}
            />
            <div className="editor-actions">
              <button
                className="text-button"
                onClick={() => {
                  pause();
                  setDurationText(
                    track.roundDuration?.toString() ??
                      (defaults.mode === "sequential"
                        ? String(initial.end - initial.start)
                        : ""),
                  );
                  setError("");
                  setSelection(initial);
                  setMode(track.mode ?? "same");
                  setTab("a");
                  setOther(track.segmentB ?? initial);
                  selected.current = initial;
                  setHead(initial.start);
                  if (view) setView(focusRange(initial));
                }}
              >
                {copy["Reset"]}
              </button>
              <button
                className="primary"
                disabled={saving || !!validation || !!pairError}
                onClick={async () => {
                  setSaving(true);
                  pause();
                  try {
                    await onSave({
                      ...track,
                      duration,
                      segmentStart: aSelection.start,
                      segmentEnd: aSelection.end,
                      mode,
                      postRoll,
                      segmentB: mode === "matched" ? bSelection : undefined,
                      analysis,
                      roundDuration: locked,
                      preRoll: track.preRoll,
                      waveformPeaks: wave,
                      isPrepared: true,
                    });
                  } catch (e) {
                    setError(displayError(e));
                    setSaving(false);
                  }
                }}
              >
                {saving ? copy["Saving…"] : copy["Save Segment"]}
              </button>
            </div>
          </>
        )
      )}
    </section>
  );
}
