import type { LocalRaw } from './core';
/** Real pretrained music tagging vectors, not fabricated section labels or downbeats. */
export async function refineMusic(pcm: Float32Array, base: string): Promise<NonNullable<LocalRaw['embeddings']>> {
  const [tf, converter, wasmBackend, wasm, core] = await Promise.all([
    import('@tensorflow/tfjs-core'),
    import('@tensorflow/tfjs-converter'),
    import('@tensorflow/tfjs-backend-wasm'),
    import('essentia.js/dist/essentia-wasm.es.js'),
    import('essentia.js/dist/essentia.js-core.es.js'),
  ]);
  // Single-thread WASM works without SharedArrayBuffer/COOP/COEP on GitHub Pages.
  wasmBackend.setThreadsCount(1);
  wasmBackend.setWasmPaths(new URL('models/runtime/',base).href);
  if (!await tf.setBackend('wasm')) throw new Error('WASM backend unavailable');
  await tf.ready();
  const module = typeof wasm.EssentiaWASM === 'function' ? await wasm.EssentiaWASM() : wasm.EssentiaWASM;
  const extractor = new core.default(module);
  const model = await converter.loadGraphModel(new URL('models/musicnn/model.json',base).href);
  const output: NonNullable<LocalRaw['embeddings']> = [];
  // 187 frames x 256-hop at 16kHz. Process every patch across the full track,
  // batch size one; no whole-song spectrogram or GPU resource retention.
  const stride=187*256;
  try {
    for(let start=0;start<pcm.length;start+=stride){
      const mel:number[][]=[];
      for(let f=0;f<187;f++){
        const frame=new Float32Array(512), offset=start+f*256;
        frame.set(pcm.subarray(offset,Math.min(offset+512,pcm.length)));
        const vector=extractor.arrayToVector(frame);
        const bands=extractor.TensorflowInputMusiCNN(vector).bands;
        try { mel.push(Array.from(extractor.vectorToArray(bands))); }
        finally { bands.delete(); vector.delete(); }
      }
      const input=tf.tensor3d([mel],[1,187,96]);
      const inputs:Record<string,import('@tensorflow/tfjs-core').Tensor>={};
      for(const info of model.inputs) inputs[info.name]=info.dtype==='bool' ? tf.tensor([false],[1],'bool') : input;
      let prediction: import('@tensorflow/tfjs-core').Tensor | undefined;
      try {
        prediction=model.execute(inputs,'model/Sigmoid') as import('@tensorflow/tfjs-core').Tensor;
        const values=Array.from(await prediction.data());
        if(values.length!==50 || !values.every(Number.isFinite)) throw new Error('Invalid musicnn output');
        output.push({start:start/16000,end:Math.min(start+stride,pcm.length)/16000,values});
      } finally { prediction?.dispose();for(const value of new Set(Object.values(inputs)))value.dispose(); }
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return output;
  } finally {model.dispose();extractor.delete();}
}
