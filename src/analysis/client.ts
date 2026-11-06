import { audioHash } from '../utils/audioHash';
import { readFile } from '../utils/storage';
import type { AnalysisResult } from '../types/analysis';
import { readRaw, writeRaw } from './cache';
import { rankLocal, type LocalRaw, type RankConfig } from './core';
const hashes = new Map<string,string>();
const memory = new Map<string,LocalRaw>();
export const browserAnalysisEnabled = (import.meta as ImportMeta & {env?:Record<string,string>}).env?.VITE_ANALYSIS_BACKEND !== 'server';
async function identity(id:string) {
  const file = await readFile(id);
  let hash = hashes.get(id);
  if (!hash) { hash = await audioHash(await file.arrayBuffer()); hashes.set(id,hash); }
  return {file,hash};
}
export async function cachedLocal(id:string,c:RankConfig,signal:AbortSignal) {
  const {hash} = await identity(id);
  signal.throwIfAborted();
  const raw=memory.get(hash) ?? await readRaw(hash);
  signal.throwIfAborted();
  return raw ? rankLocal(raw,hash,c,true) : undefined;
}
/** Jobs are serialized by autoAnalysis, independently of the playback AudioContext. */
export async function analyzeLocal(id:string,c:RankConfig,signal:AbortSignal,onQuick:(r:AnalysisResult)=>void):Promise<AnalysisResult> {
  const start=performance.now(), {file,hash}=await identity(id);
  signal.throwIfAborted();
  const cached=memory.get(hash) ?? await readRaw(hash);
  signal.throwIfAborted();
  if(cached?.embeddings?.length) return rankLocal(cached,hash,c,true);
  if(cached) onQuick(rankLocal(cached,hash,c,true));
  // Offline decoding never changes the running player's context/session.
  const context=new OfflineAudioContext(1,1,16000);
  const buffer=await context.decodeAudioData(await file.arrayBuffer());
  signal.throwIfAborted();
  if(buffer.duration>900) throw new Error('本地分析支持15分钟以内的歌曲；仍可手动选段。');
  const render=new OfflineAudioContext(1,Math.ceil(buffer.duration*16000),16000);
  const source=render.createBufferSource(); source.buffer=buffer; source.connect(render.destination); source.start();
  const mono=(await render.startRendering()).getChannelData(0);
  signal.throwIfAborted();
  const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  return new Promise((resolve,reject)=>{
    let latest:AnalysisResult|undefined=cached ? rankLocal(cached,hash,c,true) : undefined;
    const stop=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();};
    const abort=()=>{stop();reject(new DOMException('Aborted','AbortError'));};
    const fallback=(message:string)=>{stop();if(latest) resolve({...latest,warnings:[message]});else reject(new Error(message));};
    const timer=setTimeout(()=>fallback('本地 AI 优化超时，已保留快速推荐。'),180000);
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror=(event)=>{event.preventDefault();fallback('此设备暂时无法完成本地 AI 优化，已保留快速推荐。');};
    worker.onmessage=(event:MessageEvent<{kind:string;raw?:LocalRaw;error?:string}>)=>{
      if(signal.aborted) return abort();
      const {kind,raw,error}=event.data;
      if(raw){
        raw.elapsedSeconds=(performance.now()-start)/1000;
        memory.set(hash,raw); if(memory.size>6) memory.delete(memory.keys().next().value!);
        void writeRaw(hash,raw);
        latest=rankLocal(raw,hash,c);
        if(kind==='quick') onQuick(latest);
        else {stop();resolve(latest);}
      }else if(error) fallback(error);
    };
    worker.postMessage({pcm:mono,base:new URL((import.meta as ImportMeta & {env:{BASE_URL:string}}).env.BASE_URL,location.href).href},[mono.buffer]);
  });
}
