import { AudioEngine } from "../src/audio/AudioEngine";
export async function runEditorAudioTests() {
  const results: string[] = [];
  const assert = (ok: boolean, label: string) => {
    if (!ok) throw new Error(label);
    results.push(label);
  };
  function setup(seconds = 1) {
    const context = new OfflineAudioContext(1, 48000 * seconds, 48000);
    const engine = new AudioEngine();
    const internals = engine as unknown as {
      context: BaseAudioContext;
      master: GainNode;
    };
    internals.context = context;
    internals.master = context.createGain();
    internals.master.connect(context.destination);
    engine.resume = async () => {};
    const buffer = context.createBuffer(1, 48000 * 3, 48000);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = 0.1 + (i / 48000) * 0.1;
    return { context, engine, buffer };
  }
  const { context, engine, buffer } = setup();
  await engine.playRange(buffer, 0.2, 0.8);
  const rendered = await context.startRendering();
  const data = rendered.getChannelData(0);
  assert(
    Math.abs(data[9600] - 0.137) < 0.00001,
    "Editor playback seeks within full buffer",
  );
  assert(
    data.slice(32000).every((x) => x === 0),
    "Preview stops on audio clock without UI timers",
  );
  assert(
    engine.previewSnapshot().position === 0.8 &&
      !engine.previewSnapshot().playing,
    "Playhead clamps at preview end",
  );
  const paused = setup();
  await paused.engine.playRange(paused.buffer, 0.2, 1);
  const suspension = paused.context.suspend(0.2),
    render = paused.context.startRendering();
  await suspension;
  const position = paused.engine.pausePreview();
  await paused.context.resume();
  const result = await render;
  assert(
    position !== undefined && Math.abs(position - 0.37) < 0.004,
    "Pause returns the current audio position",
  );
  assert(
    result
      .getChannelData(0)
      .slice(12000)
      .every((x) => x === 0),
    "Pause fades then silences source",
  );
  assert(
    !paused.engine.previewSnapshot().playing,
    "Paused editor transport does not auto-resume",
  );
  const cancelled = setup();
  let release!: () => void;
  cancelled.engine.resume = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const pending = cancelled.engine.playRange(cancelled.buffer, 0, 1);
  cancelled.engine.pausePreview();
  release();
  assert(
    (await pending) === false,
    "Drag/pause cancels pending AudioContext resume",
  );
  let rejected = false;
  try {
    await engine.playRange(buffer, 3, 3);
  } catch {
    rejected = true;
  }
  assert(rejected, "Track-end play request is safely rejected");
  return results;
}
