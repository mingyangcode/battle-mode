import { quickFeatures } from './core';
import { refineMusic } from './musicModel';
const port = self as unknown as { postMessage: (v:unknown)=>void; onmessage: ((e:MessageEvent<{pcm:Float32Array;base:string}>)=>void)|null };
port.onmessage=async ({data:{pcm,base}})=>{
  try {
    const raw=quickFeatures(pcm,16000);
    port.postMessage({kind:'quick',raw});
    try {
      raw.embeddings=await refineMusic(pcm,base);
      port.postMessage({kind:'deep',raw});
    } catch(error) {
      console.warn('Browser model refinement failed',error);
      port.postMessage({kind:'error',error:'本地 AI 优化暂不可用，快速推荐仍可使用。'});
    }
  } catch {
    port.postMessage({kind:'error',error:'本地音频分析失败，仍可手动选段。'});
  }
};
