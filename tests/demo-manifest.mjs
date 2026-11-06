import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const { tracks } = JSON.parse(
  await readFile("public/demo/manifest.json", "utf8"),
);
assert.equal(tracks.length, 3);
assert.deepEqual(
  tracks.map((x) => x.track.mode),
  ["same", "matched", "sequential"],
);
for (const { track: t, audio } of tracks) {
  assert.equal(t.roundDuration, 45);
  assert(t.isPrepared);
  assert.equal(t.playedCount, 0);
  assert.equal(t.analysis.quality, "deep");
  assert.equal(t.analysis.recommendationMode, t.mode);
  assert.equal(t.analysis.roundDuration, 45);
  assert(Math.abs(t.segmentEnd - t.segmentStart - 45) < 0.001);
  assert(t.segmentStart >= 0 && t.segmentEnd <= t.duration);
  assert.equal(
    createHash("sha256")
      .update(await readFile("public" + audio))
      .digest("hex"),
    t.analysis.trackHash,
  );
  assert((await readFile("public" + t.coverUrl)).length > 100);
  assert(
    t.waveformPeaks.length >= 720 &&
      t.waveformPeaks.every((v) => v >= 0 && v <= 1),
  );
  if (t.mode === "matched") {
    assert(Math.abs(t.segmentB.end - t.segmentB.start - 45) < 0.001);
    assert(t.segmentB.end <= t.duration);
    assert.notEqual(t.segmentB.start, t.segmentStart);
  }
  if (t.mode === "sequential") assert(t.segmentStart + 100 <= t.duration);
}
console.log(
  "PASS three genuine preanalyzed 45s demos, asset hashes/covers/waves, matched B and sequential tail",
);
