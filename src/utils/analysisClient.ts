import { analyzeLocal, cachedLocal, browserAnalysisEnabled } from "../analysis/client";
export { browserAnalysisEnabled };
import { audioHash } from "./audioHash";
import { apiFetch } from "./api";
import { copy } from "../copy/zh-CN";
import type { AnalysisResult } from "../types/analysis";
import { readFile } from "./storage";
export async function analyzeTrack(
  trackId: string,
  roundDuration: number,
  signal: AbortSignal,
): Promise<AnalysisResult> {
  if (browserAnalysisEnabled) return analyzeLocal(trackId, {length:roundDuration,mode:"same",pre:5,post:5}, signal, () => {});
  const form = new FormData();
  form.append("file", await readFile(trackId), "track.audio");
  form.append("roundDuration", String(roundDuration));
  const response = await apiFetch("/api/analyze", {
    method: "POST",
    body: form,
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : copy["Analysis unavailable. You can continue editing manually."],
    );
  if (
    !data ||
    !Number.isFinite(data.bpm) ||
    !Array.isArray(data.beats) ||
    !Array.isArray(data.downbeats) ||
    !Array.isArray(data.sections) ||
    !Array.isArray(data.recommendations) ||
    !Array.isArray(data.matchedPairs)
  )
    throw new Error(
      copy["Analysis unavailable. You can continue editing manually."],
    );
  return data as AnalysisResult;
}

export async function analyzeProgressive(
  trackId: string,
  roundDuration: number,
  signal: AbortSignal,
  onQuick: (r: AnalysisResult) => void,
  mode: "same" | "matched" | "sequential" = "same",
  preRoll = 5,
  postRoll = 5,
  onJob?: (id: string) => void,
): Promise<AnalysisResult> {
  if (browserAnalysisEnabled) return analyzeLocal(trackId, {length:roundDuration,mode,pre:preRoll,post:postRoll}, signal, onQuick);
  const form = new FormData();
  form.append("file", await readFile(trackId), "track.audio");
  form.append("roundDuration", String(roundDuration));
  form.append("mode", mode);
  form.append("preRoll", String(preRoll));
  form.append("postRoll", String(postRoll));
  const mark = (r: AnalysisResult): AnalysisResult => ({
    ...r,
    recommendationMode: mode,
    preRoll,
    postRoll,
  });
  const parse = async (response: Response) => {
    const body = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(body.detail ?? copy["Analysis unavailable"]),
        {
          status: response.status,
        },
      );
    return body;
  };
  let job = await parse(
    await apiFetch("/api/analysis/jobs", { method: "POST", body: form, signal }),
  );
  if (job.status === "complete") return mark(job.result);
  onJob?.(job.id);
  onQuick(mark(job.result));
  while (job.status === "refining") {
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, 1000);
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    });
    job = await parse(await apiFetch(`/api/analysis/jobs/${job.id}`, { signal }));
  }
  if (job.status !== "complete")
    throw new Error(job.error ?? copy["Refinement unavailable"]);
  return mark(job.result);
}

const trackHashes = new Map<string, string>();
export async function readCachedAnalysis(
  trackId: string,
  length: number,
  mode: "same" | "matched" | "sequential",
  preRoll: number,
  postRoll: number,
  signal: AbortSignal,
): Promise<AnalysisResult | undefined> {
  if (browserAnalysisEnabled) return cachedLocal(trackId, {length, mode, pre:preRoll, post:postRoll}, signal);
  let hash = trackHashes.get(trackId);
  if (!hash) {
    const bytes = await (await readFile(trackId)).arrayBuffer();
    hash = await audioHash(bytes);
    trackHashes.set(trackId, hash);
  }
  if (signal.aborted) return;
  const params = new URLSearchParams({
    trackHash: hash,
    roundDuration: String(length),
    mode,
    preRoll: String(preRoll),
    postRoll: String(postRoll),
  });
  const response = await apiFetch("/api/analysis/cached?" + params, { signal });
  if (!response.ok) return;
  const { result } = await response.json();
  return result
    ? { ...result, recommendationMode: mode, preRoll, postRoll }
    : undefined;
}

export function prioritizeAnalysisJob(id: string) {
  if (browserAnalysisEnabled) return Promise.resolve();
  return apiFetch(`/api/analysis/jobs/${encodeURIComponent(id)}/priority`, { method: "POST" });
}
