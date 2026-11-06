import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
async function load(name) {
  const { outputText } = ts.transpileModule(
    await fs.readFile(`src/state/${name}.ts`, "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext } },
  );
  return import(
    "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
  );
}
const { swipeDestination } = await load("pageSwipe");
assert.equal(swipeDestination("music", -65, 2), "live");
assert.equal(swipeDestination("live", 65, 2), "music");
assert.equal(swipeDestination("music", 65, 2), undefined);
assert.equal(swipeDestination("live", 63, 2), undefined);
assert.equal(swipeDestination("live", 70, 60), undefined);
const q = await load("liveQueue");
for (const n of [0, 1, 5, 10]) {
  let s = { items: [] };
  for (let i = 0; i < n; i++)
    s = q.enqueue(s, { id: String(i), trackId: "duplicate", createdAt: i });
  assert.equal(s.items.length, n);
  if (n) {
    s = q.reorderQueued(s, "0", n - 1);
    assert.equal(s.items.at(-1).id, "0");
    s = q.reorderQueued(s, "0", 0);
    assert.equal(s.items[0].id, "0");
    assert.equal(q.promoteHead(s, "stale"), s);
    const promoted = q.promoteHead(s, "0");
    assert.equal(promoted.items.length, n - 1);
    assert.equal(promoted.armedRoundId, "0");
    assert.equal(q.removeQueued(s, "0").items.length, n - 1);
  }
  assert.equal(q.pruneQueue(s, new Set()).items.length, 0);
}
console.log(
  "PASS V1.5: directional swipe thresholds, vertical intent; queue 0/1/5/10, duplicate tracks, reorder both directions, remove, guarded head promotion, deleted-track pruning",
);
const { QueuePreload } = await load("queuePreload");
const slot = new QueuePreload();
let releases = [],
  calls = [];
const decode = (t) => {
  calls.push(t.id);
  return new Promise((resolve) => releases.push(resolve));
};
const first = slot.select("one", { id: "a" }, decode);
await Promise.resolve();
const stale = slot.select("two", { id: "b" }, decode);
const latest = slot.select("three", { id: "c" }, decode);
assert.deepEqual(calls, ["a"]);
releases.shift()("old");
await first;
await stale;
await Promise.resolve();
assert.deepEqual(calls, ["a", "c"]);
assert.equal(slot.buffer, undefined);
releases.shift()("new");
await latest;
assert.equal(slot.buffer, "new");
assert.equal(slot.id, "three");
await slot.select("duplicate", { id: "c" }, decode);
assert.equal(slot.buffer, "new");
assert.equal(calls.length, 2);
const removed = slot.select("four", { id: "d" }, decode);
await Promise.resolve();
slot.clear();
releases.shift()("deleted");
await removed;
assert.equal(slot.buffer, undefined);
assert.equal(slot.track, undefined);
assert.equal(slot.loading, false);
await slot.select("failure", { id: "bad" }, async () => {
  throw new Error("decode");
});
assert.ok(slot.error);
assert.equal(slot.loading, false);
console.log(
  "PASS V1.5 preload: serial decode, stale head skipped, removal invalidates, duplicate reuse, errors recover",
);
const {queueIntent,queueRelease}=await load('queueGesture');
assert.equal(queueIntent(5,4),'pending');assert.equal(queueIntent(-30,4),'swipe');assert.equal(queueIntent(12,30),'scroll');assert.equal(queueIntent(30,25),'scroll');
assert.equal(queueRelease(0),'close');assert.equal(queueRelease(-60),'open');assert.equal(queueRelease(-88),'open');assert.equal(queueRelease(-1000),'open');assert.equal(queueRelease(100),'close');
console.log('PASS queue gestures: intent locking, left reveal only, full swipe never deletes, right closes');
