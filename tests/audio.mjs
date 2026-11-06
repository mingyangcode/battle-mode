import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
async function moduleUrl(path) {
  let { outputText } = ts.transpileModule(await readFile(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  for (const match of [...outputText.matchAll(/from ["'](\.[^"']+)["']/g)]) {
    outputText = outputText.replace(
      match[1],
      await moduleUrl(new URL(match[1] + ".ts", path)),
    );
  }
  return (
    "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
  );
}
async function moduleFrom(path) {
  return import(await moduleUrl(path));
}
const { makeSchedule, phaseAt } = await moduleFrom(
  new URL("../src/state/roundMachine.ts", import.meta.url),
);
const { powerCurve } = await moduleFrom(
  new URL("../src/audio/crossfade.ts", import.meta.url),
);
for (const segment of [
  { segmentStart: 76.4, segmentEnd: 117.1, preRoll: 5 },
  { segmentStart: 0, segmentEnd: 10, preRoll: 5 },
  { segmentStart: 2, segmentEnd: 6, preRoll: 5 },
]) {
  const s = makeSchedule(100, segment, 0.5),
    length = segment.segmentEnd - segment.segmentStart;
  assert.equal(s.offset, Math.max(0, segment.segmentStart - 5));
  assert.ok(Math.abs(s.a - s.start - (segment.segmentStart - s.offset)) < 1e-9);
  assert.ok(Math.abs(s.b - s.a - length) < 1e-9);
  assert.ok(Math.abs(s.judging - s.b - length) < 1e-9);
  assert.equal(phaseAt(s.a, s), "DANCER_A");
  assert.equal(phaseAt(s.b, s), "TRANSITION");
  assert.equal(phaseAt(s.transitionEnd, s), "DANCER_B");
  assert.equal(phaseAt(s.judging + 50, s), "JUDGING");
}
const a = powerCurve(false),
  b = powerCurve(true);
for (let i = 0; i < a.length; i++)
  assert.ok(Math.abs(a[i] ** 2 + b[i] ** 2 - 1) < 1e-6);
console.log(
  "PASS: schedule boundaries, identical segment durations, clamped pre-roll, equal-power crossfade.",
);
console.log(
  "Real Web Audio rendering tests: open /tests/audio.html while running Vite.",
);

const editor = await moduleFrom(
  new URL("../src/state/segmentEditor.ts", import.meta.url),
);
const selection = { start: 76.4, end: 117.1 };
assert.deepEqual(editor.lockDuration(selection, 40, 240), {
  start: 76.4,
  end: 116.4,
});
assert.deepEqual(
  editor.moveBoundary({ start: 10, end: 50 }, "start", 235, 240, 40),
  { start: 200, end: 240 },
);
assert.deepEqual(
  editor.moveBoundary({ start: 10, end: 50 }, "end", 5, 240, 40),
  { start: 0, end: 40 },
);
assert.deepEqual(
  editor.moveBoundary({ start: 10, end: 50 }, "end", 150, 240, 40),
  { start: 110, end: 150 },
);
assert.deepEqual(
  editor.moveBoundary({ start: 10, end: 50 }, "start", -100, 240, 40),
  { start: 0, end: 40 },
);
assert.deepEqual(editor.lockDuration({ start: 220, end: 230 }, 40, 240), {
  start: 200,
  end: 240,
});
assert.deepEqual(editor.lockDuration({ start: 12, end: 20 }, 32, 32), {
  start: 0,
  end: 32,
});
assert.throws(() => editor.lockDuration(selection, 300, 240));
assert.ok(editor.durationError("300", 240));
assert.ok(editor.durationError("0", 240));
assert.equal(editor.durationError("", 240), "");
for (let value = -100; value < 400; value += 0.37) {
  for (const edge of ["start", "end"]) {
    const s = editor.moveBoundary(selection, edge, value, 240, 40);
    assert.ok(s.start >= 0 && s.end <= 240);
    assert.ok(Math.abs(s.end - s.start - 40) < 1e-9);
  }
}
assert.deepEqual(
  editor.moveBoundary({ start: 10, end: 50 }, "start", 20, 240),
  { start: 20, end: 50 },
);
assert.deepEqual(editor.previewRange("start", { start: 2, end: 42 }, 240), {
  start: 0,
  end: 7,
});
assert.deepEqual(editor.previewRange("end", { start: 190, end: 230 }, 232), {
  start: 225,
  end: 232,
});
assert.deepEqual(editor.previewRange("end", { start: 0, end: 2 }, 32), {
  start: 0,
  end: 7,
});
assert.deepEqual(editor.focusedViewport({ start: 80, end: 120 }, 240), {
  start: 70,
  end: 130,
});
assert.deepEqual(editor.focusedViewport({ start: 2, end: 31 }, 32), {
  start: 0,
  end: 32,
});
assert.equal(editor.positionFromDrag(80, 50, 300, { start: 70, end: 130 }), 90);
assert.equal(
  editor.positionFromDrag(80, -1000, 300, { start: 70, end: 130 }),
  70,
);
assert.deepEqual(selection, { start: 76.4, end: 117.1 });
console.log(
  "PASS: fixed-length movement, duration validation, both boundary clamps, legacy free editing, preview ranges, focus mapping.",
);
const modes = await moduleFrom(
  new URL("../src/state/segmentModes.ts", import.meta.url),
);
assert.deepEqual(modes.applyRecommendation({ start: 12, end: 52 }, 200, 40), {
  start: 12,
  end: 52,
});
assert.throws(() =>
  modes.applyRecommendation({ start: 180, end: 220 }, 200, 40),
);
assert.throws(() => modes.applyRecommendation({ start: 10, end: 51 }, 200, 40));
assert.deepEqual(
  modes.applyPair(
    { segmentA: { start: 10, end: 50 }, segmentB: { start: 100, end: 140 } },
    200,
    40,
  ),
  { a: { start: 10, end: 50 }, b: { start: 100, end: 140 } },
);
assert.throws(() =>
  modes.applyPair(
    { segmentA: { start: 10, end: 50 }, segmentB: { start: 10, end: 50 } },
    200,
    40,
  ),
);
console.log(
  "PASS: recommendation bounds, fixed duration, matched pair independence and equal length.",
);
const { makeLiveSchedule, remainingAt } = await moduleFrom(
  new URL("../src/state/roundMachine.ts", import.meta.url),
);
for (const segmentB of [
  undefined,
  { start: 120, end: 160 },
  { start: 0, end: 40 },
]) {
  const s = makeLiveSchedule(
    100,
    { segmentStart: 20, segmentEnd: 60, preRoll: 5 },
    200,
    { segmentB },
  );
  assert.equal(s.aEnd - s.a, 40);
  assert.equal(s.judging - s.bPerformance, 40);
  assert.equal(s.bOffset, Math.max(0, (segmentB?.start ?? 20) - 5));
  assert.equal(phaseAt(s.start, s), "PRE_A");
  assert.equal(phaseAt(s.a, s), "DANCER_A");
  assert.equal(phaseAt(s.bPerformance, s), "DANCER_B");
  assert.equal(phaseAt(s.judging, s), "JUDGING");
  assert.equal(remainingAt(s.judging, s), undefined);
  assert.equal(remainingAt(s.a + 10, s), 30);
  if (s.bOffset < (segmentB?.start ?? 20)) {
    assert.equal(phaseAt(s.transitionEnd, s), "PRE_B");
    assert.ok(Math.abs(remainingAt(s.b + 1, s) - 4) < 1e-9);
  }
  assert.ok(Math.abs(s.transitionEnd - s.b - 0.5) < 1e-9);
}
const snapped = makeLiveSchedule(
  0,
  { segmentStart: 20, segmentEnd: 60, preRoll: 5 },
  200,
  {
    segmentB: { start: 120, end: 160 },
    analysis: { bpm: 120, beats: [60.1, 115.1, 115.6], downbeats: [115.1] },
  },
);
assert.ok(Math.abs(snapped.bOffset - 115.1) < 1e-9);
assert.ok(Math.abs(snapped.b - snapped.aEnd - 0.1) < 1e-9);
assert.ok(Math.abs(remainingAt(snapped.b, snapped) - 4.9) < 1e-9);
assert.throws(() =>
  makeLiveSchedule(0, { segmentStart: 20, segmentEnd: 60, preRoll: 5 }, 200, {
    segmentB: { start: 120, end: 159 },
  }),
);
console.log(
  "PASS: Same/Matched B pre-roll, complete equal performance times, beat snapping, fallback and audio-clock countdown.",
);
const preStart = makeLiveSchedule(
  0,
  { segmentStart: 2, segmentEnd: 6, preRoll: 5 },
  32,
  {},
);
assert.equal(
  remainingAt(0, preStart),
  2,
  "Scheduling lead-in must not add an extra countdown second",
);
const deletion = await moduleFrom(
  new URL("../src/state/deletion.ts", import.meta.url),
);
const library = [{ id: "a" }, { id: "b" }, { id: "c" }];
assert.deepEqual(deletion.withoutTrack(library, "b"), [
  { id: "a" },
  { id: "c" },
]);
assert.deepEqual(
  deletion.restoreTrack(deletion.withoutTrack(library, "b"), { id: "b" }, 1),
  library,
);
assert.equal(deletion.restoreTrack(library, { id: "b" }, 1), library);
assert.equal(deletion.swipeOutcome(-45, 390), "open");
assert.equal(deletion.swipeOutcome(-190, 390), "delete");
assert.equal(deletion.swipeOutcome(-5, 390), "closed");
console.log(
  "PASS: delete/undo identity, ordering, partial/full swipe thresholds.",
);
const loopLogic = await moduleFrom(
  new URL("../src/state/judgingLoop.ts", import.meta.url),
);
const loopPlan = loopLogic.judgingLoopPlan(20, 15, 30);
assert.equal(loopPlan.first, 19.5);
assert.equal(loopLogic.judgingLoopPosition(19.5, 19.5, 29.5), 0);
assert.equal(loopLogic.judgingLoopPosition(49, 19.5, 29.5), 0);
assert.equal(loopLogic.judgingLoopPosition(50, 19.5, 29.5), 1);
assert.equal(loopLogic.judgingLoopPlan(20, 20, 30).first, 20);
console.log("PASS: Judging loop wrap and no pre-Judging wrap.");

const sequential = await moduleFrom(
  new URL("../src/state/sequential.ts", import.meta.url),
);
assert.deepEqual(sequential.modeDefaults({}), { mode: "same", postRoll: 5 });
const flow = sequential.deriveSequential(60, 40);
assert.deepEqual(flow, {
  a: { start: 60, end: 100 },
  b: { start: 105, end: 145 },
  preStart: 55,
  bPreStart: 100,
  postEnd: 150,
});
assert.equal(sequential.sequentialMaxStart(180, 40), 90);
assert.equal(sequential.clampSequential(170, 40, 180).a.start, 90);
assert.throws(() => sequential.clampSequential(0, 40, 80));
assert.deepEqual(sequential.clampSequential(60, 30, 180).b, {
  start: 95,
  end: 125,
});
const cont = makeLiveSchedule(
  0,
  { segmentStart: 60, segmentEnd: 100, preRoll: 5 },
  180,
  { mode: "sequential" },
);
assert.equal(phaseAt(cont.b, cont), "PRE_B");
assert.equal(phaseAt(cont.bPerformance, cont), "DANCER_B");
assert.equal(phaseAt(cont.bEnd, cont), "POST_B");
assert.equal(remainingAt(cont.bEnd, cont), 5);
assert.equal(phaseAt(cont.judging, cont), "JUDGING");
assert.equal(cont.transitionEnd, cont.b);
assert.equal(remainingAt(cont.bPerformance, cont), 40);
assert.throws(() =>
  makeLiveSchedule(0, { segmentStart: 100, segmentEnd: 140, preRoll: 5 }, 180, {
    mode: "sequential",
  }),
);
console.log(
  "PASS: Continue derivation, bounds, insufficient tail, duration changes, migration and audio-clock POST B.",
);
