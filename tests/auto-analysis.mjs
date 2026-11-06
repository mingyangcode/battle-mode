import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const state = (globalThis.__autoTest = {
  runs: [],
  cached: [],
  writes: [],
  results: new Map(),
});
const result = (length, quality = "deep") => ({
  roundDuration: length,
  quality,
  recommendations: [],
  matchedPairs: [],
  warnings: [],
});
let code = ts.transpileModule(
  await readFile("src/state/autoAnalysis.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const modules = {
  "../copy/zh-CN": ts.transpileModule(
    await readFile("src/copy/zh-CN.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext } },
  ).outputText,
  "../utils/storage": `export async function patchTrack(id,p){globalThis.__autoTest.writes.push({id,p});}`,
  "../utils/analysisClient": `export const browserAnalysisEnabled = false; export async function prioritizeAnalysisJob(){}; export async function readCachedAnalysis(id,length){const s=globalThis.__autoTest;s.cached.push({id,length});return s.results.get(id)?.(length);}
 export function analyzeProgressive(id,length,signal,quick,mode,pre,post,onJob){return new Promise((resolve,reject)=>{globalThis.__autoTest.runs.push({id,length,quick,resolve,reject});});}`,
};
for (const [name, source] of Object.entries(modules))
  code = code.replace(
    name,
    "data:text/javascript;base64," + Buffer.from(source).toString("base64"),
  );
const queue = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const tick = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};
const add = (id) => queue.configurePreparation(id, 45, "same");
add("a");
add("b");
add("deleted");
add("focused");
queue.removePreparation("deleted");
queue.prioritizePreparation("focused");
await tick();
assert.deepEqual(
  state.runs.map((r) => r.id),
  ["a"],
  "Only one Quick launch in flight",
);
state.runs[0].quick(result(45, "quick"));
await tick();
assert.deepEqual(
  state.runs.map((r) => r.id),
  ["a", "focused"],
  "Editor takes next Quick slot",
);
state.runs[1].quick(result(45, "quick"));
await tick();
assert.equal(state.runs[2].id, "b");
add("fourth");
state.runs[2].quick(result(45, "quick"));
await tick();
assert.equal(state.runs.length, 3, "Three pending jobs bound upload pressure");
state.results.set("a", (length) => result(length, "quick"));
queue.configurePreparation("a", 30, "same");
await tick();
assert.equal(queue.getPreparation("a").result.roundDuration, 30);
assert.equal(
  state.runs.length,
  3,
  "Duration change never launches another Deep",
);
state.results.set("a", (length) => result(length));
state.runs[0].resolve(result(45));
await tick();
assert.equal(queue.getPreparation("a").result.roundDuration, 30);
assert.equal(state.runs[3].id, "fourth");
queue.removePreparation("b");
const before = state.writes.filter((w) => w.id === "b").length;
state.runs[2].resolve(result(45));
await tick();
assert.equal(
  state.writes.filter((w) => w.id === "b").length,
  before,
  "Late completion cannot write removed track",
);
state.runs[1].resolve(result(45));
state.runs[3].reject(new Error("offline"));
await tick();
assert.equal(queue.getPreparation("fourth").status, "manual");
state.results.set("cached", (length) => result(length));
add("cached");
await tick();
assert.equal(queue.getPreparation("cached").status, "deep");
assert.equal(state.runs.length, 4, "Cache hit does not analyze");
assert.ok(!state.runs.some((r) => r.id === "deleted"));
console.log(
  "PASS: automatic queue, Quick concurrency, editor priority, bounded pending jobs, delete cancellation, late completion protection, duration rerank, cache reuse, failure fallback.",
);

const callsBeforeSaved = state.runs.length;
queue.configurePreparation('prepared-demo',45,'matched',5,5,{...result(45),recommendationMode:'matched',preRoll:5,postRoll:5});
await tick();
assert.equal(queue.getPreparation('prepared-demo').status,'deep');
assert.equal(state.runs.length,callsBeforeSaved,'Saved matching Deep result works without network/model');
assert.equal(queue.getPreparation('fourth').error,'offline');
console.log('PASS saved Deep offline readiness and visible failure reason');

for (const mode of ['same','matched','sequential']) {
 queue.configurePreparation('offline-demo-'+mode,45,mode,5,5,{...result(45),recommendationMode:mode,preRoll:5,postRoll:5});
 assert.equal(queue.getPreparation('offline-demo-'+mode).status,'deep');
}
assert.equal(state.runs.length,callsBeforeSaved,'All three demo modes bypass analysis service');
console.log('PASS all demo modes ready without service');
