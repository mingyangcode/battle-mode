import React from "react";
import { createRoot } from "react-dom/client";
import { SegmentEditorPage } from "../src/pages/SegmentEditorPage";
import { saveTrack, removeTrack } from "../src/utils/storage";
import { demoBuffer } from "../src/audio/demo";
import "../src/style.css";
const id = "v11-analysis-ui-fixture";
const track = {
  id,
  title: "Progressive regression fixture",
  duration: 32,
  preRoll: 5,
  segmentStart: 2,
  segmentEnd: 4,
  roundDuration: 2,
  isPrepared: true,
  playedCount: 0,
};
await saveTrack(track, new Blob(["disposable fixture"]));
let refined = false,
  failed = false;
const base = {
  trackHash: "test",
  analysisVersion: "fixture",
  recommendationVersion: "fixture",
  roundDuration: 2,
  duration: 32,
  bpm: 120,
  beats: [2, 2.5, 3],
  downbeats: [],
  sections: [],
  matchedPairs: [],
  analyzer: "fixture",
  cacheHit: false,
  rawCacheHit: false,
  warnings: [],
};
const quick = {
  ...base,
  quality: "quick",
  elapsedSeconds: 0.25,
  recommendations: [{ start: 4, end: 6, score: 0.8 }],
};
const deep = {
  ...base,
  quality: "deep",
  elapsedSeconds: 1.5,
  recommendations: [{ start: 12, end: 14, score: 0.9 }],
};
window.fetch = async (input) => {
  const url = String(input);
  if (failed)
    return Response.json({ detail: "Fixture unavailable" }, { status: 503 });
  if (url.includes("/status"))
    return Response.json({ ready: true, warming: false });
  if (url.includes("/cached")) return Response.json({ result: null });
  return Response.json({
    id: "fixture",
    status: refined ? "complete" : "refining",
    result: refined ? deep : quick,
  });
};
document.querySelector<HTMLButtonElement>("#deep")!.onclick = () => {
  refined = true;
};
document.querySelector<HTMLButtonElement>("#fail")!.onclick = () => {
  failed = true;
};
document.querySelector<HTMLButtonElement>("#clean")!.onclick = async () => {
  await removeTrack(id);
  document.querySelector("#status")!.textContent = "Fixture cleaned";
};
const buffer = demoBuffer(new OfflineAudioContext(1, 32000, 8000));
createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <SegmentEditorPage
      track={track}
      load={async () => buffer}
      onBack={() => {}}
      onSave={async (t) => {
        document.querySelector("#status")!.textContent =
          `Saved manual segment ${t.segmentStart} → ${t.segmentEnd}`;
      }}
    />
  </React.StrictMode>,
);
