import { copy, phaseLabels, displayError } from "../copy/zh-CN";
import { useEffect, useState } from "react";
import { audio } from "../audio/AudioEngine";
import { demoBuffer } from "../audio/demo";
export function AudioSpikePage() {
  const [status, setStatus] = useState("READY"),
    [position, setPosition] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => {
      const s = audio.snapshot();
      setStatus(s.phase);
      setPosition(s.position);
      if (s.finished) audio.stop();
    }, 50);
    return () => {
      clearInterval(timer);
      audio.stop();
    };
  }, []);
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>{copy["Battle Mode · Audio Spike"]}</h1>
      <p>{copy["完整 32 秒测试音轨 · Start 6s / End 10s / Pre 5s"]}</p>
      <h2>{phaseLabels[status] ?? status}</h2>
      <p>
        {copy["原曲播放头"]}
        {position.toFixed(2)}
        {copy["s"]}
      </p>
      <button
        onClick={() =>
          audio
            .start(demoBuffer(audio.ctx), {
              segmentStart: 6,
              segmentEnd: 10,
              preRoll: 5,
            })
            .catch((e) => setError(displayError(e)))
        }
      >
        {copy["START ROUND"]}
      </button>{" "}
      <button onClick={() => audio.end()}>{copy["END ROUND"]}</button>
      <p>{error}</p>
    </main>
  );
}
