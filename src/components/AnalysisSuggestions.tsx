import { copy, analysisWarning } from "../copy/zh-CN";
import { useEffect, useSyncExternalStore } from "react";
import {
  subscribePreparation,
  getPreparation,
  configurePreparation,
  preparationLabel,
} from "../state/autoAnalysis";
import type {
  AnalysisResult,
  SegmentRange,
  MatchedSegmentRecommendation,
} from "../types/analysis";
import type { SegmentMode } from "../state/segmentModes";
import { time } from "../utils/time";
export function AnalysisSuggestions({
  trackId,
  length,
  mode,
  preRoll = 5,
  postRoll = 5,
  result,
  onResult,
  onApply,
  onPair,
}: {
  trackId: string;
  length: number;
  mode: SegmentMode;
  preRoll?: number;
  postRoll?: number;
  result?: AnalysisResult;
  onResult: (r: AnalysisResult) => void;
  onApply: (r: SegmentRange) => void;
  onPair: (p: MatchedSegmentRecommendation) => void;
}) {
  const preparation = useSyncExternalStore(subscribePreparation, () =>
    getPreparation(trackId),
  );
  const latest = preparation.result;
  useEffect(() => {
    const timer = setTimeout(
      () =>
        configurePreparation(trackId, length, mode, preRoll, postRoll, result),
      250,
    );
    return () => clearTimeout(timer);
  }, [trackId, length, mode, preRoll, postRoll]);
  useEffect(() => {
    if (latest) onResult(latest);
  }, [latest]);
  const fresh =
    result &&
    Math.abs(result.roundDuration - length) < 0.001 &&
    (mode === "sequential"
      ? result.recommendationMode === "sequential" &&
        (result.preRoll ?? 5) === preRoll &&
        (result.postRoll ?? 5) === postRoll
      : result.recommendationMode !== "sequential");
  return (
    <div className="panel analysis-panel">
      <div className="panel-heading">
        <h3>{copy["智能推荐"]}</h3>
        <span role="status" className="hint">
          {latest?.analyzer === "browser-musicnn" ? "本地 AI 优化已就绪" : latest?.analyzer === "browser-quick" ? "本地快速推荐已就绪" : preparationLabel(preparation.status)}
          {preparation.error && <span role="status"> · {preparation.error}</span>}
        </span>
      </div>
      <p className="hint">
        {preparation.status === "preparing" || preparation.status === "queued"
          ? copy["正在为你准备合适的对战片段…"]
          : preparation.status === "manual"
            ? copy["可继续手动编辑。"]
            : preparation.status === "deep"
              ? copy["发现更合适的片段"]
              : copy["推荐已就绪，可直接试听或调整。"]}
      </p>
      {latest?.analyzer?.startsWith("browser-") && <p className="hint">音频在本机分析，不上传服务器。{preparation.refining && "正在进行 AI 优化，可先使用快速推荐。"}{latest.elapsedSeconds !== undefined && ` · ${latest.elapsedSeconds.toFixed(1)}秒`}</p>}
      {!fresh && result && (
        <p className="hint">
          {preparation.status === "manual"
            ? copy["暂无此时长推荐，可手动编辑。"]
            : copy["正在准备此时长的推荐，可继续手动编辑。"]}
        </p>
      )}
      {fresh && (
        <div className="suggestions">
          {mode !== "matched"
            ? result.recommendations.slice(0, 3).map((r, i) => (
                <div className="suggestion" key={i}>
                  <div>
                    <strong>
                      {copy["Suggestion"]}
                      {i + 1}
                    </strong>
                    <p>
                      {time(r.start, true)} → {time(r.end, true)}
                    </p>
                  </div>
                  <button className="secondary" onClick={() => onApply(r)}>
                    {copy["Apply"]}
                  </button>
                </div>
              ))
            : result.matchedPairs.slice(0, 3).map((p, i) => (
                <div className="suggestion" key={i}>
                  <div>
                    <strong>
                      {copy["Pair"]}
                      {i + 1}
                    </strong>
                    <p>
                      {copy["A ·"]}
                      {time(p.segmentA.start, true)} →{" "}
                      {time(p.segmentA.end, true)}
                      <br />
                      {copy["B ·"]}
                      {time(p.segmentB.start, true)} →{" "}
                      {time(p.segmentB.end, true)}
                    </p>
                  </div>
                  <button className="secondary" onClick={() => onPair(p)}>
                    {copy["Apply Pair"]}
                  </button>
                </div>
              ))}
          {(mode !== "matched" ? result.recommendations : result.matchedPairs)
            .length === 0 && (
            <p className="hint">
              {copy["没有足够的候选片段，请缩短时长或手动编辑。"]}
            </p>
          )}
          {result.warnings.map((w, i) => (
            <p className="hint" key={i}>
              {analysisWarning(w)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
