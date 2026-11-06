import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
let saved = "broken";
globalThis.localStorage = {
  getItem: () => saved,
  setItem: (_key, value) => {
    saved = value;
  },
};
const code = ts.transpileModule(
  await readFile("src/state/onboarding.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText;
const load = async (n) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(code + `\n//${n}`).toString("base64")
  );
const guide = await load(1);
assert.equal(guide.guideSeen("music"), false);
guide.completeGuide("music");
assert.equal(guide.guideSeen("music"), true);
assert.equal(guide.guideSeen("editor"), false);
guide.completeGuide("editor");
assert.deepEqual(JSON.parse(saved), { music: true, editor: true });
const reloaded = await load(2);
assert.equal(reloaded.guideSeen("editor"), true);
assert.equal(reloaded.guideSeen("live"), false);
globalThis.localStorage = {
  getItem: () => {
    throw Error("blocked");
  },
  setItem: () => {
    throw Error("blocked");
  },
};
reloaded.completeGuide("live");
assert.equal(reloaded.guideSeen("live"), true);
assert.equal(guide.ONBOARDING_VERSION, "battle-onboarding-v1");
console.log(
  "PASS: versioned per-page completion, corrupted preferences, reload persistence and unavailable storage fallback.",
);
