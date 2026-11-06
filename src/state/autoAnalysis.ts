import { copy } from "../copy/zh-CN";
import type { AnalysisResult } from "../types/analysis";
import type { Track } from "../types/track";
import type { SegmentMode } from "./segmentModes";
import {
  prioritizeAnalysisJob,
  browserAnalysisEnabled,
  analyzeProgressive,
  readCachedAnalysis,
} from "../utils/analysisClient";
import { patchTrack } from "../utils/storage";
export type PreparationStatus =
  "queued" | "preparing" | "quick" | "deep" | "manual";
export interface Preparation {
  status: PreparationStatus;
  result?: AnalysisResult;
  error?: string;
  refining?: boolean;
}
interface Config {
  length: number;
  mode: SegmentMode;
  pre: number;
  post: number;
}
interface Entry {
  config: Config;
  state: Preparation;
  running: boolean;
  completed: boolean;
  job?: string;
  controller?: AbortController;
  retryAt: number;
}
const entries = new Map<string, Entry>(),
  listeners = new Set<() => void>();
let current: string | undefined,
  launching = false,
  active = 0,
  backoffUntil = 0;
const empty: Preparation = { status: "manual" };
const key = (c: Config) => JSON.stringify(c);
const emit = () => listeners.forEach((fn) => fn());
export const subscribePreparation = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getPreparation = (id: string) => entries.get(id)?.state ?? empty;
export const preparationLabel = (s: PreparationStatus) =>
  s === "deep"
    ? copy["精细推荐已就绪"]
    : s === "quick"
      ? copy["快速推荐已就绪"]
      : s === "manual"
        ? copy["可手动编辑"]
        : s === "queued"
          ? "等待分析队列"
          : copy["准备中"];
function publish(
  id: string,
  e: Entry,
  result?: AnalysisResult,
  status?: PreparationStatus,
) {
  if (entries.get(id) !== e) return;
  e.state = {
    status: status ?? (result?.quality === "quick" ? "quick" : "deep"),
    result: result ?? e.state.result,
    refining: e.running && (result?.quality ?? e.state.result?.quality) === "quick",
    error: result ? undefined : e.state.error,
  };
  emit();
  if (result) void patchTrack(id, { analysis: result }).catch(() => {});
}
async function cached(id: string, e: Entry) {
  const c = e.config;
  try {
    const r = await readCachedAnalysis(
      id,
      c.length,
      c.mode,
      c.pre,
      c.post,
      new AbortController().signal,
    );
    if (key(c) === key(e.config) && r) publish(id, e, r);
    return r;
  } catch {
    return undefined;
  }
}
export function prepareTrack(track: Track) {
  configurePreparation(
    track.id,
    track.roundDuration ?? Math.min(45, track.duration),
    track.mode ?? "same",
    track.preRoll,
    track.postRoll ?? 5,
    track.analysis,
  );
}
export function configurePreparation(
  id: string,
  length: number,
  mode: SegmentMode,
  pre = 5,
  post = 5,
  saved?: AnalysisResult,
) {
  if (!Number.isFinite(length) || length < 0.5) return;
  const config = { length, mode, pre, post };
  let e = entries.get(id);
  if (!e) {
    const reusable =
      saved?.quality === "deep" &&
      saved.roundDuration === length &&
      (saved.recommendationMode ?? "same") === mode &&
      (saved.preRoll ?? 5) === pre &&
      (saved.postRoll ?? 5) === post;
    e = {
      config,
      state: { status: reusable ? "deep" : "queued", result: saved },
      running: false,
      completed: reusable,
      retryAt: 0,
    };
    entries.set(id, e);
    emit();
    pump();
    return;
  }
  if (key(e.config) === key(config)) return;
  e.config = config;
  // A pending full-song job remains the same job. Only cached raw features rerank.
  if (e.completed && e.state.status === "manual") {
    e.completed = false;
    pump();
    return;
  }
  if (e.running || e.completed) {
    void cached(id, e).then((r) => {
      if (!r && e.completed) {
        if (browserAnalysisEnabled) { e.completed = false; pump(); }
        else publish(id, e, undefined, "manual");
      }
    });
    return;
  }
  pump();
}
export function prioritizePreparation(id?: string) {
  current = id;
  const e = id ? entries.get(id) : undefined;
  if (id && e && !e.completed)
    void cached(id, e).then((r) => {
      if (r?.quality === "deep") {
        e.completed = true;
        emit();
      }
    });
  if (e?.job) void prioritizeAnalysisJob(e.job).catch(() => {});
  pump();
}
export function removePreparation(id: string) {
  entries.get(id)?.controller?.abort();
  entries.delete(id);
  emit();
  pump();
}
function pump() {
  if (launching || active >= (browserAnalysisEnabled ? 1 : 3) || Date.now() < backoffUntil) return;
  const candidates = [...entries].filter(
    ([, e]) => !e.running && !e.completed && e.retryAt <= Date.now(),
  );
  candidates.sort(([a], [b]) => Number(b === current) - Number(a === current));
  const next = candidates[0];
  if (!next) return;
  const [id, e] = next;
  e.running = true;
  launching = true;
  active++;
  publish(id, e, undefined, "preparing");
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      launching = false;
      pump();
    }
  };
  void (async () => {
    try {
      const hit = await cached(id, e);
      if (entries.get(id) !== e) return;
      if (hit?.quality !== "quick" && hit) {
        e.completed = true;
        return;
      }
      const c = e.config;
      e.controller = new AbortController();
      const result = await analyzeProgressive(
        id,
        c.length,
        e.controller.signal,
        (r) => {
          if (key(c) === key(e.config)) publish(id, e, r);
          else void cached(id, e);
          release();
        },
        c.mode,
        c.pre,
        c.post,
        (job) => {
          e.job = job;
          if (current === id) prioritizePreparation(id);
        },
      );
      if (key(c) === key(e.config)) publish(id, e, result);
      else await cached(id, e);
      e.completed = true;
    } catch (error) {
      if (entries.get(id) === e)
        e.state = {
          ...e.state,
          error:
            error instanceof Error
              ? error.message
              : "分析连接失败，请检查网络后刷新重试。",
        };
      if ((error as { status?: number }).status === 429) {
        backoffUntil = Date.now() + 10000;
        e.retryAt = backoffUntil;
        publish(id, e, undefined, "queued");
        setTimeout(pump, 10100);
      } else {
        e.completed = true;
        publish(
          id,
          e,
          undefined,
          e.state.result?.quality === "quick" ? "quick" : "manual",
        );
      }
    } finally {
      e.running = false;
      if (entries.get(id) === e) { e.state = {...e.state, refining:false}; emit(); }
      active--;
      release();
      pump();
    }
  })();
}
