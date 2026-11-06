import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const code = ts.transpileModule(
  await readFile("src/utils/artwork.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { embeddedArtwork, coverGradient } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const sync = (n) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
for (const version of [3, 4]) {
  const payload = Buffer.concat([
    Buffer.from([0]),
    Buffer.from("image/png\0"),
    Buffer.from([3, 0]),
    bytes,
  ]);
  const frame = Buffer.alloc(10);
  frame.write("APIC");
  if (version === 3) frame.writeUInt32BE(payload.length, 4);
  else frame.set(sync(payload.length), 4);
  const tag = Buffer.from([
    73,
    68,
    51,
    version,
    0,
    0,
    ...sync(10 + payload.length),
  ]);
  const cover = await embeddedArtwork(new Blob([tag, frame, payload]));
  assert.equal(cover.type, "image/png");
  assert.deepEqual(new Uint8Array(await cover.arrayBuffer()), bytes);
  assert.equal(
    await embeddedArtwork(new Blob([tag, frame, payload.subarray(0, 3)])),
    undefined,
  );
}
assert.equal(await embeddedArtwork(new Blob(["RIFF ordinary WAV"])), undefined);
assert.equal(
  await embeddedArtwork(
    new Blob([new Uint8Array([73, 68, 51, 4, 0, 0, ...sync(5000000)])]),
  ),
  undefined,
);
assert.equal(coverGradient("stable"), coverGradient("stable"));
console.log(
  "PASS: ID3 v2.3/v2.4 covers, truncated/oversized/non-ID3 fallback and stable gradient.",
);
