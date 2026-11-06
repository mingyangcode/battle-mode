import { staticAsset } from "./staticAsset";
import type { Track } from "../types/track";
import { demoInstalled, installDemo } from "./storage";
interface Demo {
  track: Track;
  audio: string;
}
let installing: Promise<void> | undefined;
/** Local static assets only; prepared analyses work without the API. No model runs on import. */
export function installDemoLibrary() {
  return (installing ??= (async () => {
    const response = await fetch(staticAsset("/demo/manifest.json"), {
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("示例音乐暂时无法加载，请刷新重试。");
    const { tracks } = (await response.json()) as { tracks: Demo[] };
    if (!Array.isArray(tracks)) throw new Error("示例音乐配置无效。");
    for (const { track, audio } of tracks) {
      if (
        !track.id.startsWith("demo-") ||
        !audio.startsWith("/demo/") ||
        !track.coverUrl?.startsWith("/demo/") ||
        track.roundDuration !== 45 ||
        !track.isPrepared ||
        track.analysis?.quality !== "deep" ||
        track.analysis.roundDuration !== 45 ||
        !track.waveformPeaks?.length
      )
        throw new Error("示例音乐尚未完成预分析。");
      if (await demoInstalled(track.id)) continue;
      const response = await fetch(staticAsset(audio), {
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error("示例音频下载失败，请刷新重试。");
      await installDemo(track, await response.blob());
    }
  })().finally(() => {
    installing = undefined;
  }));
}
