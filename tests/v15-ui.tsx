import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { LiveRoundPage } from "../src/pages/LiveRoundPage";
import { audio } from "../src/audio/AudioEngine";
import type { Track } from "../src/types/track";
import "../src/style.css";
import "../src/styles/tokens.css";
import "../src/styles/redesign.css";
import "../src/styles/motion.css";
import "../src/styles/v14.css";
import "../src/styles/v15.css";
function Fixture() {
  const [count, setCount] = useState(0);
  const [tracks, setTracks] = useState<Track[]>(
    ["A", "B", "C"].map((x, i) => ({
      id: x,
      title: `Test ${x}`,
      duration: 12,
      segmentStart: 1,
      segmentEnd: 2.5,
      preRoll: 0.5,
      postRoll: 0.5,
      mode: i === 1 ? "sequential" : "same",
      isPrepared: true,
      playedCount: 0,
    })),
  );
  return (
    <>
      <p role="status">Completed rounds: {count}</p>
      <LiveRoundPage
        tracks={tracks}
        load={async (t) => {
          const b = audio.ctx.createBuffer(1, 48000 * 12, 48000),
            data = b.getChannelData(0);
          for (let n = 0; n < data.length; n++)
            data[n] =
              0.05 *
              Math.sin((n / 48000) * Math.PI * 2 * (t.id === "A" ? 220 : 330));
          return b;
        }}
        onActive={() => {}}
        onComplete={async (t) => {
          setCount((n) => n + 1);
          setTracks((ts) =>
            ts.map((x) =>
              x.id === t.id ? { ...x, playedCount: x.playedCount + 1 } : x,
            ),
          );
        }}
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
