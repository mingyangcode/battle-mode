import {analyzeLocal,cachedLocal} from '../src/analysis/client';
import {saveTrack} from '../src/utils/storage';
const log=document.querySelector('#log')!;
const write=(s:string)=>{log.textContent+='\n'+s;};
const config={length:45,mode:'same' as const,pre:5,post:5};
let id='test-local-analysis-spring';
const base=import.meta.env.BASE_URL;
async function run(fresh=false,cancelAfterQuick=false){
 const controller=new AbortController();
 log.textContent='开始真实全曲分析';
 try{
  const manifest=await(await fetch(base+'demo/manifest.json')).json();const demo=manifest.tracks[0];
  let blob=await(await fetch(base+demo.audio.replace(/^\//,''))).blob();
  if(fresh){id='test-local-analysis-spring-'+Date.now();blob=new Blob([blob,new TextEncoder().encode(id)],{type:'audio/mpeg'});}
  await saveTrack({...demo.track,id,analysis:undefined},blob);
  const start=performance.now();
  const result=await analyzeLocal(id,config,controller.signal,r=>{write(`QUICK ${(performance.now()-start).toFixed(0)}ms ${r.recommendations.length}建议 bpm=${r.bpm.toFixed(1)}`);if(cancelAfterQuick) controller.abort();});
  write(`FINAL ${result.quality} ${(performance.now()-start).toFixed(0)}ms ${result.analyzer}`);write(JSON.stringify(result,null,2));
 }catch(e){write(cancelAfterQuick && e instanceof DOMException && e.name==='AbortError' ? 'PASS cancel after Quick' : 'ERROR '+String(e));}
}
document.querySelector('#run')!.addEventListener('click',()=>void run());
document.querySelector('#fresh')!.addEventListener('click',()=>void run(true));
document.querySelector('#cancel-active')!.addEventListener('click',()=>void run(true,true));
document.querySelector('#cache')!.addEventListener('click',async()=>{
 const start=performance.now();const r=await cachedLocal(id,{...config,length:30,mode:'sequential'},new AbortController().signal);
 write(r&&r.cacheHit&&r.recommendations.every(x=>x.start+70<=r.duration)?`PASS cache rerank ${(performance.now()-start).toFixed(0)}ms ${r.quality}`:'FAIL cache');
});
document.querySelector('#abort')!.addEventListener('click',async()=>{
 const c=new AbortController();c.abort();try{await analyzeLocal(id,config,c.signal,()=>{});write('FAIL abort');}catch(e){write(e instanceof DOMException&&e.name==='AbortError'?'PASS abort':'FAIL '+String(e));}
});
