import {CoachMarks} from "../src/components/CoachMarks";
import "../src/styles/motion.css";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { LiveRoundPage } from "../src/pages/LiveRoundPage";
import { demoBuffer } from "../src/audio/demo";
import { audio } from "../src/audio/AudioEngine";
import type { Track } from "../src/types/track";
import { peaks } from "../src/utils/time";
import "../src/style.css";
import "../src/styles/redesign.css";
import "../src/styles/v14.css";
const buffer = demoBuffer(new OfflineAudioContext(1, 32000, 8000));
const base = {
  duration: buffer.duration,
  preRoll: 1,
  postRoll: 1,
  segmentStart: 5,
  segmentEnd: 7,
  roundDuration: 2,
  isPrepared: true,
  playedCount: 0,
  waveformPeaks: peaks(buffer, 720),
};
const initial: Track[] = [
  { ...base, id: "design-same", title: "同段测试 · 无封面音乐", mode: "same" },
  {
    ...base,
    id: "design-matched",
    title:
      "匹配测试 · 一首很长很长的歌曲名称用来检查换行与播放器按钮是否被挤出手机屏幕",
    mode: "matched",
    segmentB: { start: 12, end: 14 },
  },
  {
    ...base,
    id: "design-sequential",
    title: "顺延测试 · 连续原曲时间线",
    mode: "sequential",
  },
  { ...base, id: "design-error", title: "音频加载失败测试", mode: "same" },
];
function Fixture() {
  const [tracks, setTracks] = useState(initial);
  const [active,setActive] = useState(false);
  return (
    <div className="app app-live">
      <header className="app-header">
        <b>对战模式 · 视觉测试</b><CoachMarks page="live" disabled={active}/>
      </header>
      <main className="app-main">
        <LiveRoundPage
          tracks={tracks}
          load={async (t) => {
            if (t.id === "design-error")
              throw new Error("找不到本地音频，请重新导入。");
            return buffer;
          }}
          onActive={setActive}
          onComplete={async (t) => {
            setTracks((ts) => ts.map((x) => (x.id === t.id ? t : x)));
          }}
        />
      </main>
    </div>
  );
}
window.addEventListener("pagehide", () => audio.stop());
createRoot(document.getElementById("root")!).render(<Fixture />);
